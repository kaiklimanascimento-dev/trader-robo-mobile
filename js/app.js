// Aplicação Principal do Robô Trader
class TraderRobot {
    constructor() {
        this.api = new IQOptionAPI();
        this.strategies = new PriceActionStrategies();
        this.analysis = new ProfessionalAnalysis();

        this.isRunning = false;
        this.currentTrade = null;
        this.martingaleCount = 0;
        this.sessionProfit = 0;
        this.trades = [];

        this.chart = null;
        this.priceData = [];
        this.timeLabels = [];

        this.balanceInterval = null;
        this.dataInterval = null;

        this.initEventListeners();
    }

    initEventListeners() {
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }
        const startBtn = document.getElementById('startBtn');
        const stopBtn  = document.getElementById('stopBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        if (startBtn)  startBtn.addEventListener('click',  () => this.startRobot());
        if (stopBtn)   stopBtn.addEventListener('click',   () => this.stopRobot());
        if (logoutBtn) logoutBtn.addEventListener('click', () => this.handleLogout());
    }

    // ====== LOGIN ======
    showLoginError(msg) {
        const el = document.getElementById('loginError');
        if (el) { el.textContent = '❌ ' + msg; el.style.display = 'block'; }
    }
    hideLoginError() {
        const el = document.getElementById('loginError');
        if (el) el.style.display = 'none';
    }

    async handleLogin() {
        const email       = document.getElementById('email').value.trim();
        const password    = document.getElementById('password').value;
        const accountType = document.querySelector('input[name="accountTypeRadio"]:checked')?.value || 'PRACTICE';

        if (!email || !password) {
            this.showLoginError('Por favor, preencha email e senha.');
            return;
        }
        this.hideLoginError();

        const loginData = { email, password, accountType };

        // Conta REAL exige confirmação explícita antes de conectar
        if (accountType === 'REAL') {
            showRealAccountModal(loginData);
            return;
        }
        await this.doLogin(loginData);
    }

    async doLogin({ email, password, accountType }) {
        const submitBtn = document.getElementById('loginBtn');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.innerText = 'Conectando…'; }

        try {
            const result = await this.api.login(email, password, accountType);
            if (result.success) {
                this.showDashboard();
                this.updateHeader();
                this.startBackgroundUpdates();
                if (this.api.accountWarning) {
                    this.showLoginError(this.api.accountWarning);
                }
            } else {
                this.showLoginError(result.message || 'Falha na conexão com a IQ Option.');
            }
        } catch (error) {
            this.showLoginError(error.message || 'Erro inesperado ao conectar.');
        } finally {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = 'Conectar'; }
        }
    }

    // Solicita troca de conta a partir do dashboard (abre modal de confirmação se for para REAL)
    requestSwitchAccount() {
        const target = this.api.accountType === 'REAL' ? 'PRACTICE' : 'REAL';
        if (target === 'REAL') {
            showModal('switchAccountModal');
        } else {
            this.doSwitchAccount('PRACTICE');
        }
    }

    requestSwitchToDemo() {
        this.doSwitchAccount('PRACTICE');
    }

    async doSwitchAccount(targetType) {
        try {
            const result = await this.api.switchAccount(targetType);
            if (result.success) {
                this.updateHeader();
                this.updateStatsDisplay();
            } else {
                alert('Não foi possível trocar de conta: ' + (result.message || 'erro desconhecido') +
                      '\nFaça logout e login novamente selecionando a conta desejada.');
            }
        } catch (error) {
            alert('Erro ao trocar de conta: ' + error.message);
        }
    }

    showDashboard() {
        document.getElementById('loginSection').classList.remove('active');
        document.getElementById('dashboardSection').classList.add('active');
        document.getElementById('analysisSection').classList.add('active');
        this.initChart();
        this.updateStatsDisplay();
    }

    updateHeader() {
        const accountType = this.api.accountType || 'PRACTICE';
        const balance = this.api.balance || 0;
        const userInfo = document.getElementById('userInfo');
        if (userInfo) {
            userInfo.innerHTML = `
                <span class="status-badge conectado" style="color:#28a745;font-weight:bold;">
                    Conectado | ${accountType} | Saldo: R$ ${balance.toFixed(2)}
                </span>`;
        }

        // Badge de conta ativa + banner de aviso quando REAL
        const badge  = document.getElementById('activeAccountBadge');
        const banner = document.getElementById('realAccountBanner');
        const switchBtn = document.getElementById('switchAccountBtn');
        if (badge) {
            const isReal = accountType === 'REAL';
            badge.textContent = isReal ? 'REAL' : 'DEMO';
            badge.style.background = isReal ? '#c0392b' : '#1e8449';
            badge.style.color = '#fff';
            if (banner) banner.style.display = isReal ? 'block' : 'none';
            if (switchBtn) switchBtn.textContent = isReal ? '🔄 Ir para Demo' : '🔄 Ir para Real';
        }
    }

    // ====== ATUALIZAÇÕES EM BACKGROUND ======
    startBackgroundUpdates() {
        // Busca saldo e candles a cada 10 segundos
        this.balanceInterval = setInterval(() => this.refreshBalance(), 10000);
        // Atualiza gráfico e análise a cada 15 segundos
        this.dataInterval = setInterval(() => this.refreshChartAndAnalysis(), 15000);
        // Executar imediatamente na primeira vez
        this.refreshBalance();
        this.refreshChartAndAnalysis();
    }

    async refreshBalance() {
        try {
            const balance = await this.api.getBalance();
            this.api.balance = balance;
            this.updateHeader();
            this.updateStatsDisplay();
        } catch (e) {
            console.warn('Não foi possível atualizar saldo:', e.message);
        }
    }

    async refreshChartAndAnalysis() {
        const asset     = document.getElementById('asset')?.value || 'EURUSD';
        const timeframe = document.getElementById('timeframe')?.value || 'M1';
        try {
            const candles = await this.api.getPriceHistory(asset, timeframe, 50);
            if (candles && candles.length > 0) {
                this.updateChartData(candles);
                this.updateAnalysis(candles, asset);
            }
        } catch (e) {
            console.warn('Falha ao atualizar gráfico/análise:', e.message);
        }
    }

    // ====== CHART ======
    initChart() {
        const ctx = document.getElementById('priceChart');
        if (!ctx) return;
        if (this.chart) this.chart.destroy();
        this.chart = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Preço',
                    data: [],
                    borderColor: '#00d76d',
                    backgroundColor: 'rgba(0,215,109,0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 2,
                    pointBackgroundColor: '#00d76d'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: true, position: 'top', labels: { color: '#ccc' } } },
                scales: {
                    x: { ticks: { color: '#aaa', maxTicksLimit: 10 } },
                    y: { beginAtZero: false, ticks: { color: '#aaa' } }
                }
            }
        });
    }

    updateChartData(candles) {
        if (!this.chart || !candles || candles.length === 0) return;
        this.priceData  = candles.map(c => c.close);
        this.timeLabels = candles.map(c => {
            const d = new Date(c.timestamp ? c.timestamp * 1000 : c.from * 1000 || Date.now());
            return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        });
        this.chart.data.labels = this.timeLabels;
        this.chart.data.datasets[0].data = this.priceData;
        this.chart.update('none');
    }

    // ====== ANÁLISE ======
    updateAnalysis(candles, asset) {
        if (!candles || candles.length < 10) {
            ['supportResistance','trend','volumes','patterns'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = '<p>Dados insuficientes</p>';
            });
            return;
        }

        try {
            const result = this.analysis.analyzeAsset(candles, asset);

            const srEl = document.getElementById('supportResistance');
            if (srEl && result.supportResistance && typeof result.supportResistance === 'object') {
                const sr = result.supportResistance;
                srEl.innerHTML = `
                    <strong>Preço:</strong> ${sr.currentPrice}<br>
                    <strong>Suporte S1:</strong> ${sr.support?.s1 || '-'}<br>
                    <strong>Resistência R1:</strong> ${sr.resistance?.r1 || '-'}<br>
                    <em>${sr.interpretation || ''}</em>`;
            }

            const trendEl = document.getElementById('trend');
            if (trendEl && result.trend && typeof result.trend === 'object') {
                const t = result.trend;
                trendEl.innerHTML = `
                    <strong>Tipo:</strong> ${t.type || '-'}<br>
                    <strong>Força:</strong> ${t.strength || '-'}<br>
                    <strong>ADX:</strong> ${t.adxValue || '-'}<br>
                    <em>${t.interpretation || ''}</em>`;
            }

            const volEl = document.getElementById('volumes');
            if (volEl && result.volumes && typeof result.volumes === 'object') {
                const v = result.volumes;
                volEl.innerHTML = `
                    <strong>Ratio:</strong> ${v.ratio || '-'}<br>
                    <strong>Sinal:</strong> ${v.interpretation || '-'}<br>
                    <strong>Recomendação:</strong> ${v.recommendation || '-'}`;
            }

            const patEl = document.getElementById('patterns');
            if (patEl && result.patterns && typeof result.patterns === 'object') {
                const p = result.patterns;
                const patternsHTML = Array.isArray(p.patterns) && p.patterns.length > 0
                    ? p.patterns.map(pat => `<p>🎯 <strong>${pat.name}</strong> (${pat.strength})</p>`).join('')
                    : '<p>Nenhum padrão detectado</p>';
                patEl.innerHTML = `${patternsHTML}<p><strong>${p.recommendation || ''}</strong></p>`;
            }
        } catch (e) {
            console.warn('Erro na análise:', e.message);
        }
    }

    // ====== STATS ======
    updateStatsDisplay() {
        const balance = (this.api.balance || 0) + this.sessionProfit;
        const stats   = this.strategies.getStats();
        const balEl   = document.getElementById('balance');
        const plEl    = document.getElementById('profitLoss');
        const wrEl    = document.getElementById('winRate');
        if (balEl) balEl.textContent = `R$ ${balance.toFixed(2)}`;
        if (plEl)  plEl.textContent  = `R$ ${this.sessionProfit.toFixed(2)}`;
        if (wrEl)  wrEl.textContent  = `${stats.winRate}%`;
    }

    // ====== PARÂMETROS ======
    getRobotParams() {
        return {
            initialBet: parseFloat(document.getElementById('initialBet')?.value) || 1,
            stopWin:    parseFloat(document.getElementById('stopWin')?.value)    || 0,
            stopLoss:   parseFloat(document.getElementById('stopLoss')?.value)   || 0,
        };
    }

    // ====== ROBÔ ======
    async startRobot() {
        const { initialBet, stopWin, stopLoss } = this.getRobotParams();

        if (stopWin > 0 && this.sessionProfit >= stopWin) {
            document.getElementById('tradeStatus').textContent = '🏆 Stop Win já atingido!';
            return;
        }
        if (stopLoss > 0 && this.sessionProfit <= -stopLoss) {
            document.getElementById('tradeStatus').textContent = '🛑 Stop Loss já atingido!';
            return;
        }

        this.isRunning = true;
        document.getElementById('startBtn').disabled = true;
        document.getElementById('stopBtn').disabled  = false;
        document.getElementById('tradeStatus').textContent = '⏳ Robô iniciado — buscando sinal…';

        while (this.isRunning) {
            await this.executeTrade(initialBet);
            if (this.isRunning) {
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
    }

    async executeTrade(baseAmount) {
        const asset      = document.getElementById('asset').value;
        const strategy   = document.getElementById('strategy').value;
        const timeframe  = document.getElementById('timeframe').value;
        const expiration = parseInt(document.getElementById('expiration').value);
        const martingale = parseFloat(document.getElementById('martingale').value) || 1.1;

        try {
            let candles;
            try {
                candles = await this.api.getPriceHistory(asset, timeframe, 50);
            } catch (err) {
                this.showRobotError('Falha ao obter cotações: ' + err.message);
                await new Promise(r => setTimeout(r, 5000));
                return;
            }

            if (!candles || candles.length === 0) {
                this.showRobotError('Sem dados de cotação. Aguardando…');
                return;
            }

            // Atualiza gráfico e análise com os candles recém-buscados
            this.updateChartData(candles);
            this.updateAnalysis(candles, asset);

            let signal = null;
            if (strategy === 'fluxo')      signal = this.strategies.analyzeFluxo(candles);
            else if (strategy === 'reversao') signal = this.strategies.analyzeReversao(candles);
            else if (strategy === 'hibrida')  signal = this.strategies.analyzeHibrida(candles);

            if (!signal || !signal.direction) {
                document.getElementById('tradeStatus').textContent = '🔍 Sem sinal claro — aguardando próximo ciclo…';
                return;
            }

            const tradeAmount = this.martingaleCount > 0
                ? baseAmount * Math.pow(martingale, this.martingaleCount)
                : baseAmount;

            this.updateTradeInfo(signal, tradeAmount);

            const placed = await this.api.placeBet(asset, signal.direction, tradeAmount, expiration);
            if (!placed.success) {
                this.showRobotError('Falha ao enviar ordem: ' + (placed.message || 'erro desconhecido'));
                return;
            }

            this.currentTrade = {
                asset, direction: signal.direction, amount: tradeAmount,
                price: signal.price, time: new Date(),
                orderId: placed.data?.tradeId,
                durationSeconds: placed.data?.durationSeconds || expiration * 60,
            };

            document.getElementById('tradeStatus').textContent =
                `⏳ Operação enviada — aguardando expiração (${expiration} min)…`;

            try {
                const res = await this.api.checkTradeResult(
                    this.currentTrade.orderId,
                    this.currentTrade.durationSeconds
                );
                let tradeResult = (res.win || 'loss').toUpperCase();
                if (tradeResult === 'EQUAL') tradeResult = 'LOSS';
                this.handleTradeResult(tradeResult, tradeAmount, res.profitAmount);
            } catch (err) {
                this.showRobotError('Não foi possível obter resultado: ' + err.message);
            }

            // Atualiza saldo após operação
            await this.refreshBalance();

        } catch (error) {
            console.error('Erro ao executar trade:', error);
            this.showRobotError('Erro inesperado: ' + error.message);
        }
    }

    showRobotError(msg) {
        console.error('🤖 Robô:', msg);
        const el = document.getElementById('tradeStatus');
        if (el) el.textContent = '⚠️ ' + msg;
    }

    handleTradeResult(result, amount, profitAmount) {
        const profit = result === 'WIN'
            ? (profitAmount != null ? profitAmount : amount)
            : -amount;

        if (result === 'WIN') {
            this.sessionProfit += profit;
            this.martingaleCount = 0;
            this.strategies.stats.wins++;
        } else {
            this.sessionProfit += profit; // já é negativo
            this.martingaleCount++;
            this.strategies.stats.losses++;
        }

        const trade = {
            time: new Date(),
            asset: this.currentTrade?.asset || '-',
            direction: this.currentTrade?.direction || '-',
            amount, result, profit
        };
        this.trades.push(trade);
        this.addTradeToHistory(trade);
        this.updateStatsDisplay();

        const { stopWin, stopLoss } = this.getRobotParams();
        const emoji = result === 'WIN' ? '✅ WIN' : '❌ LOSS';
        document.getElementById('tradeStatus').textContent = `${emoji} — aguardando próximo ciclo…`;

        if (stopWin > 0 && this.sessionProfit >= stopWin) {
            document.getElementById('tradeStatus').textContent = '🏆 Stop Win atingido! Robô parado.';
            this.stopRobot();
        } else if (stopLoss > 0 && this.sessionProfit <= -stopLoss) {
            document.getElementById('tradeStatus').textContent = '🛑 Stop Loss atingido! Robô parado.';
            this.stopRobot();
        }
    }

    stopRobot() {
        this.isRunning = false;
        document.getElementById('startBtn').disabled = false;
        document.getElementById('stopBtn').disabled  = true;
    }

    updateTradeInfo(signal, amount) {
        document.getElementById('tradeStatus').textContent = '🔄 Enviando operação…';
        document.getElementById('tradeEntry').textContent    = `R$ ${amount.toFixed(2)}`;
        document.getElementById('tradeDirection').textContent = signal.direction === 'CALL' ? '🔼 SUBIDA' : '🔽 QUEDA';
        document.getElementById('tradePrice').textContent    = signal.price ? signal.price.toFixed(5) : '-';
        document.getElementById('tradeTime').textContent     = new Date().toLocaleTimeString('pt-BR');
        document.getElementById('tradeMartingale').textContent = this.martingaleCount;
    }

    addTradeToHistory(trade) {
        const historyBody = document.getElementById('historyBody');
        if (!historyBody) return;
        const row = historyBody.insertRow(0);
        const cls = trade.result === 'WIN' ? 'win' : 'loss';
        row.innerHTML = `
            <td>${trade.time.toLocaleTimeString('pt-BR')}</td>
            <td>${trade.asset}</td>
            <td>${trade.direction === 'CALL' ? '🔼 CALL' : '🔽 PUT'}</td>
            <td>R$ ${trade.amount.toFixed(2)}</td>
            <td class="${cls}">${trade.result === 'WIN' ? '🏆 WIN' : '❌ LOSS'}</td>
            <td class="${cls}">R$ ${trade.profit.toFixed(2)}</td>`;
        while (historyBody.rows.length > 10) historyBody.deleteRow(historyBody.rows.length - 1);
    }

    handleLogout() {
        this.stopRobot();
        if (this.balanceInterval) clearInterval(this.balanceInterval);
        if (this.dataInterval)   clearInterval(this.dataInterval);
        this.api.logout();
        this.sessionProfit    = 0;
        this.martingaleCount  = 0;
        this.trades           = [];

        document.getElementById('dashboardSection').classList.remove('active');
        document.getElementById('analysisSection').classList.remove('active');
        document.getElementById('loginSection').classList.add('active');
        document.getElementById('userInfo').innerHTML = '<span>Não conectado</span>';
        document.getElementById('balance').textContent    = 'R$ 0,00';
        document.getElementById('profitLoss').textContent = 'R$ 0,00';
        document.getElementById('winRate').textContent    = '0%';
        const loginForm = document.getElementById('loginForm');
        if (loginForm) loginForm.reset();
    }
}

// Inicializar
let robot;
document.addEventListener('DOMContentLoaded', () => {
    robot = new TraderRobot();
    console.log('🤖 Trader Robô Mobile — pronto!');
});
