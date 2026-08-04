const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());

// Servir arquivos estáticos (index.html, js/, css/)
app.use(express.static(path.join(__dirname)));

// Sessões em memória (mock)
const sessions = {};

function generateToken() {
  return (Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
}

function simulatePriceData(asset, count = 50) {
  const basePrice = {
    'EURUSD': 1.0850,
    'GBPUSD': 1.2650,
    'USDJPY': 110.50,
    'USDCAD': 1.2550,
    'BTCUSD': 42000
  };
  const base = basePrice[asset] || 1.0;
  const candles = [];

  for (let i = 0; i < count; i++) {
    const variance = (Math.random() - 0.5) * 0.005;
    const open = base + variance;
    const close = open + (Math.random() - 0.5) * 0.003;
    const high = Math.max(open, close) + Math.abs(Math.random()) * 0.002;
    const low = Math.min(open, close) - Math.abs(Math.random()) * 0.002;

    candles.push({
      open,
      close,
      high,
      low,
      volume: Math.random() * 1000,
      time: Date.now() - (count - i) * 60000
    });
  }

  return candles;
}

// Endpoint de login (mock) compatível com o wrapper frontend
app.post('/v1.0/login', (req, res) => {
  const { email, password, account_type } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email ou senha ausente' });
  }

  // Criar sessão mock
  const token = generateToken();
  const userId = 'user_' + token.slice(0, 8);
  const balance = 1000 + Math.floor(Math.random() * 500); // saldo inicial mock

  sessions[token] = { userId, email, balance, account_type };

  // Resposta com diferentes formatos esperados pelo frontend
  return res.json({
    success: true,
    sessionData: {
      userId,
      balance,
      session: token,
      sessionData: token
    },
    message: 'Login mock realizado com sucesso'
  });
});

// Endpoint para retornar candles simulados
app.get('/api/candles/:asset', (req, res) => {
  const asset = req.params.asset;
  const timeframe = req.query.timeframe || 'M1';
  const count = parseInt(req.query.count || '50');

  const candles = simulatePriceData(asset, count);
  return res.json({ candles, timeframe });
});

// Endpoint para colocar operação (mock)
app.post('/api/trades/place', (req, res) => {
  const auth = req.headers['authorization'] || '';
  const token = auth.replace('Bearer ', '');
  const session = sessions[token];

  const { userId, asset, direction, amount } = req.body || {};
  if (!session) {
    // allow placing trades without auth in mock, but return a warning
    const tradeId = 'trade_' + generateToken().slice(0, 8);
    return res.json({ success: true, tradeId, status: 'placed', warning: 'mock-without-auth' });
  }

  // Deduzir saldo mock (não persiste entre reinícios)
  if (typeof amount === 'number') session.balance = Math.max(0, session.balance - amount);

  const tradeId = 'trade_' + generateToken().slice(0, 8);
  return res.json({ success: true, tradeId, status: 'placed' });
});

// Endpoint para obter saldo do perfil
app.get('/api/profile/balance', (req, res) => {
  const auth = req.headers['authorization'] || '';
  const token = auth.replace('Bearer ', '');
  const session = sessions[token];
  if (!session) return res.status(401).json({ success: false, message: 'Sessão inválida' });
  return res.json({ balance: session.balance });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
