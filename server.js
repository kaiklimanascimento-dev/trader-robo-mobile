const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { IQOptionClient, Direction, TimeFrame } = require('iqoptionapi-node');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const sessions = {};  // sessions[token] = { client, profile, accountType }
const orderMap = {};  // orderMap[orderId] = token

function generateToken() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function mapTimeframe(tf) {
  const map = {
    S1: TimeFrame.S1, M1: TimeFrame.M1, M5: TimeFrame.M5,
    M15: TimeFrame.M15, M30: TimeFrame.M30,
    H1: TimeFrame.H1,  H4: TimeFrame.H4, D1: TimeFrame.D1,
  };
  return map[tf] || TimeFrame.M1;
}

function getSession(req) {
  const auth = (req.headers['authorization'] || '').replace('Bearer ', '');
  return sessions[auth] ? { token: auth, ...sessions[auth] } : null;
}

// ── Login ────────────────────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  const { email, password, account_type } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email ou senha ausente' });
  }

  // Validar tipo de conta solicitado
  const requestedType = (account_type || 'PRACTICE').toUpperCase();
  if (!['PRACTICE', 'REAL'].includes(requestedType)) {
    return res.status(400).json({ success: false, message: 'Tipo de conta inválido. Use PRACTICE ou REAL.' });
  }

  try {
    const client = new IQOptionClient({ silent: true });
    await client.connect();
    const profile = await client.login({ email, password });

    // Tentar trocar para a conta solicitada se o SDK suportar
    let activeAccountType = profile.accountType || 'PRACTICE';
    if (requestedType === 'REAL' && activeAccountType !== 'REAL') {
      try {
        // Alguns builds do SDK expõem changeBalance ou switchAccount
        if (typeof client.changeBalance === 'function') {
          await client.changeBalance('REAL');
          activeAccountType = 'REAL';
        } else if (typeof client.switchAccount === 'function') {
          await client.switchAccount('REAL');
          activeAccountType = 'REAL';
        } else {
          // SDK não suporta troca — informar ao frontend
          console.warn('SDK não suporta troca para conta REAL. Mantendo PRACTICE.');
          activeAccountType = 'PRACTICE';
        }
      } catch (switchErr) {
        console.warn('Falha ao trocar para conta REAL:', switchErr.message);
        activeAccountType = profile.accountType || 'PRACTICE';
      }
    }

    const token = generateToken();
    sessions[token] = { client, profile, accountType: activeAccountType };

    return res.json({
      success: true,
      sessionData: {
        userId:          String(profile.userId),
        balance:         profile.balance,
        session:         token,
        sessionData:     token,
        currency:        profile.currency || 'BRL',
        name:            [profile.firstName, profile.lastName].filter(Boolean).join(' ') || email,
        accountType:     activeAccountType,
        requestedType,
        // Avisa se não conseguiu ativar a conta solicitada
        accountWarning:  requestedType !== activeAccountType
          ? `Não foi possível ativar conta ${requestedType}. Conectado em ${activeAccountType}.`
          : null,
      },
      message: `Conectado em conta ${activeAccountType}!`,
    });
  } catch (err) {
    console.error('Erro no login:', err.message);
    return res.status(401).json({ success: false, message: 'Falha na autenticação: ' + err.message });
  }
});

// ── Trocar tipo de conta (Demo ↔ Real) após login ──────────────────────────
app.post('/api/account/switch', async (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ success: false, message: 'Sessão inválida' });

  const { account_type } = req.body || {};
  const targetType = (account_type || 'PRACTICE').toUpperCase();

  if (!['PRACTICE', 'REAL'].includes(targetType)) {
    return res.status(400).json({ success: false, message: 'Tipo inválido. Use PRACTICE ou REAL.' });
  }

  try {
    if (typeof session.client.changeBalance === 'function') {
      await session.client.changeBalance(targetType);
    } else if (typeof session.client.switchAccount === 'function') {
      await session.client.switchAccount(targetType);
    } else {
      return res.status(501).json({
        success: false,
        message: 'Troca de conta não suportada por esta versão do SDK. Faça logout e login novamente selecionando a conta desejada.'
      });
    }

    sessions[session.token].accountType = targetType;
    const profile = session.client.getProfile?.() || session.profile;

    return res.json({
      success: true,
      accountType: targetType,
      balance: profile?.balance ?? session.profile.balance,
      message: `Conta trocada para ${targetType} com sucesso!`,
    });
  } catch (err) {
    console.error('Erro ao trocar conta:', err.message);
    return res.status(500).json({ success: false, message: 'Erro ao trocar conta: ' + err.message });
  }
});

// ── Candles ──────────────────────────────────────────────────────────────────
app.get('/api/candles/:asset', async (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Sessão inválida' });

  const asset     = req.params.asset;
  const timeframe = req.query.timeframe || 'M1';
  const count     = Math.min(parseInt(req.query.count || '50'), 500);

  try {
    const candles = await session.client.getCandles(asset, mapTimeframe(timeframe), count);
    return res.json({ candles, timeframe });
  } catch (err) {
    console.error('Erro ao buscar candles:', err.message);
    return res.status(502).json({ error: 'Falha ao obter cotações: ' + err.message });
  }
});

// ── Colocar operação ─────────────────────────────────────────────────────────
app.post('/api/trades/place', async (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ success: false, message: 'Sessão inválida' });

  const { asset, direction, amount, expiration } = req.body || {};
  if (!asset || !direction || !amount) {
    return res.status(400).json({ success: false, message: 'Parâmetros ausentes' });
  }

  // Bloco de segurança extra: logar operações em conta REAL
  if (session.accountType === 'REAL') {
    console.log(`⚠️  OPERAÇÃO REAL: ${direction} ${asset} R$${amount} exp:${expiration}min`);
  }

  try {
    const dir             = direction === 'CALL' ? Direction.Call : Direction.Put;
    const durationSeconds = Math.max(Math.round((expiration || 1) * 60), 60);

    const { orderId } = await session.client.buyBinaryOption({
      symbol: asset,
      direction: dir,
      amount: parseFloat(amount),
      durationSeconds,
    });

    orderMap[orderId] = session.token;

    return res.json({
      success: true,
      tradeId: orderId,
      status:  'placed',
      accountType: session.accountType,
      durationSeconds,
    });
  } catch (err) {
    console.error('Erro ao colocar operação:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── Resultado da operação ────────────────────────────────────────────────────
app.get('/api/trades/result/:orderId', async (req, res) => {
  const orderId   = req.params.orderId;
  const token     = orderMap[orderId];
  if (!token || !sessions[token]) {
    return res.status(404).json({ success: false, message: 'Ordem não encontrada' });
  }
  const timeoutMs = parseInt(req.query.timeoutMs || '15000');
  try {
    const result = await sessions[token].client.checkBinaryOptionResult(orderId, timeoutMs);
    delete orderMap[orderId];
    return res.json({
      success:      true,
      orderId:      result.orderId,
      win:          result.win,
      profitAmount: result.profitAmount,
    });
  } catch (err) {
    console.error('Erro ao consultar resultado:', err.message);
    return res.status(504).json({ success: false, message: 'Tempo esgotado: ' + err.message });
  }
});

// ── Saldo ────────────────────────────────────────────────────────────────────
app.get('/api/profile/balance', async (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ success: false, message: 'Sessão inválida' });
  try {
    const profile = session.client.getProfile?.();
    return res.json({
      balance:     profile?.balance ?? session.profile.balance,
      accountType: session.accountType,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── Logout ───────────────────────────────────────────────────────────────────
app.post('/api/logout', (req, res) => {
  const session = getSession(req);
  if (session) {
    try { session.client.disconnect(); } catch (_) {}
    delete sessions[session.token];
  }
  res.json({ success: true });
});

// ── Status ───────────────────────────────────────────────────────────────────
app.get('/api/status', (req, res) => {
  res.json({ ok: true, sessions: Object.keys(sessions).length });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Trader Robô Mobile — porta ${PORT}`);
});
