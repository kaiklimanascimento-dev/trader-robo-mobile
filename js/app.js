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

        this.initEventListeners();
        this.setupLoginCallback();
    }

    initEventListeners() {
        // Login
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        // Robot Controls
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');
        const logoutBtn = document.getElementById('logoutBtn');

        if (startBtn) startBtn.addEventListener('click', () => this.startRobot());
        if (stopBtn) stopBtn.addEventListener('click', () => this.stopRobot());
        if (logoutBtn) logoutBtn.addEventListener('click', () => this.handleLogout());
    }

    // Configura o ouvinte para quando o WebSocket confirmar o login com sucesso
    setupLoginCallback() {
        window.onLoginSuccess = (profileData) => {
            console.log('Login validado com sucesso via WebSocket!', profileData);
            this.showDashboard();
            this.updateUserInfo();
            alert('Conectado com sucesso!');
        };
    }

    // ====== LOGIN ======
    async handleLogin() {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const accountType = document.getElementById('accountType').value;

        if (!email || !password) {
            alert('Por favor, preencha email e senha.');
            return;
        }

        try {
            const submitBtn = document.querySelector('#loginForm button[type="submit"]');
            if (submitBtn) submitBtn.innerText = 'CONECTANDO VIA WEBSOCKET...';

            const result = await this.api.login(email, password, accountType);

            if (!result.success) {
                if (submitBtn) submitBtn.innerText = 'CONECTAR';
                alert('Erro: ' + result.message);
            }
        } catch (error) {
            const submitBtn = document.querySelector('#loginForm button[type="submit"]');
            if (submitBtn) submitBtn.innerText = 'CONECTAR';
            alert(error.message);
        }
    }

    showDashboard() {
        document.getElementById('loginSection').classList.remove('active');
        document.getElementById('dashboardSection').classList.add('active');
        document.getElementById('analysisSection').classList.add('active');
        this.initChart();
        this.startUpdatingData();
    }

    updateUserInfo() {
        const accountType = document.getElementById('accountType').value;
        const userInfo = document.getElementById('userInfo');
        if (userInfo) {
            userInfo.innerHTML = `
                <span class="status-badge conectado" style="color: #28a745;">
                    Conectado | ${accountType} | Saldo: R$ ${this.api.balance.toFixed(2)}
                </span>
            `;
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
                labels: this.timeLabels,
                datasets: [{
                    label: 'Preço',
                    data: this.priceData,
                    borderColor: '#00d76d',
                    backgroundColor: 'rgba(0, 215, 109, 0.1)',
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
                plugins: { legend: { display: true, position: 'top' } },
                scales: { y: { beginAtZero: false } }
            }
        });
    }
    // ====== ROBOT LOGIC ======
    async startRobot() {
        const initialBet = parseFloat(document.getElementById('initialBet').value);
        const stopwin = parseFloat(document.getElementById('stopwin').value);
        const stoploss = parseFloat(document.getElementById('stoploss').value);

        if (this.sessionProfit >= stopwin) {
            alert('🏆 Stop Win atingido! Robô parado.');
            return;
        }
        if (this.sessionProfit <= -stoploss) {
            alert('❌ Stop Loss atingido! Robô parado.');
            return;
        }

        this.isRunning = true;
        document.getElementById('startBtn').disabled = true;
        document.getElementById('stopBtn').disabled = false;

        while (this.isRunning) {
            await this.executeTrade(initialBet);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    async executeTrade(baseAmount) {
        const asset = document.getElementById('asset').value;
        const strategy = document.getElementById('strategy').value;
        const timeframe = document.getElementById('timeframe').value;
        const expiration = parseInt(document.getElementById('expiration').value);
        const martingale = parseInt(document.getElementById('martingale').value);

        try {
            const candles = await this.api.getPriceHistory(asset, timeframe, 50);
            if (candles.length === 0) {
                console.log('Sem dados de preço.');
                return;
            }

            let signal = null;
            if (strategy === 'fluxo') signal = this.strategies.analyzeFluxo(candles);
            else if (strategy === 'reversa') signal = this.strategies.analyzeReversa(candles);
            else if (strategy === 'hibrida') signal = this.strategies.analyzeHibrida(candles);

            if (!signal || !signal.direction) {
                console.log('Sem sinal claro.');
                return;
            }

            const tradeAmount = this.martingaleCount > 0 
                ? baseAmount * Math.pow(martingale, this.martingaleCount)
                : baseAmount;

            this.updateTradeInfo(signal, tradeAmount, asset);

            const result = await this.api.placeBet(asset, signal.direction, tradeAmount, expiration);
            if (result.success) {
                this.currentTrade = {
                    asset, direction: signal.direction, amount: tradeAmount,
                    price: signal.price, time: new Date(), signal: signal.signal, confidence: signal.confidence
                };

                await new Promise(resolve => setTimeout(resolve, expiration * 1000));
                const tradeResult = this.simulateTradeResult(signal.confidence);
                this.handleTradeResult(tradeResult, tradeAmount);
            }
        } catch (error) {
            console.error('Erro ao executar trade:', error);
        }
    }

    simulateTradeResult(confidence) {
        const winProbability = confidence / 100;
        return Math.random() < winProbability ? 'WIN' : 'LOSS';
    }

    handleTradeResult(result, amount) {
        if (result === 'WIN') {
            this.sessionProfit += amount;
            this.martingaleCount = 0;
            this.strategies.stats.wins++;
        } else {
            this.sessionProfit -= amount;
            this.martingaleCount++;
            this.strategies.stats.losses++;
        }

        const trade = {
            time: new Date(), asset: this.currentTrade.asset, direction: this.currentTrade.direction,
            amount: amount, result: result, profit: result === 'WIN' ? amount : -amount
        };

        this.trades.push(trade);
        this.updateTradeHistory(trade);
        this.updateStats();

        const stopwin = parseFloat(document.getElementById('stopwin').value);
        const stoploss = parseFloat(document.getElementById('stoploss').value);

        if (this.sessionProfit >= stopwin) {
            alert('🏆 Stop Win atingido! Robô parado.');
            this.stopRobot();
        } else if (this.sessionProfit <= -stoploss) {
            alert('❌ Stop Loss atingido! Robô parado.');
            this.stopRobot();
        }
    }

    stopRobot() {
        this.isRunning = false;
        document.getElementById('startBtn').disabled = false;
        document.getElementById('stopBtn').disabled = true;
    }

    updateTradeInfo(signal, amount, asset) {
        document.getElementById('tradeStatus').textContent = 'Em execução...';
        document.getElementById('tradeEntry').textContent = `R$ ${amount.toFixed(2)}`;
        document.getElementById('tradeDirection').textContent = signal.direction === 'CALL' ? '🔼 SUBIDA' : '🔽 QUEDA';
        document.getElementById('tradePrice').textContent = signal.price ? signal.price.toFixed(4) : '-';
        document.getElementById('tradeTime').textContent = new Date().toLocaleTimeString('pt-BR');
        document.getElementById('tradeMartingale').textContent = this.martingaleCount;
    }

    updateTradeHistory(trade) {
        const historyBody = document.getElementById('historyBody');
        if (!historyBody) return;
        const row = historyBody.insertRow(0);
        const resultClass = trade.result === 'WIN' ? 'win' : 'loss';
        const resultText = trade.result === 'WIN' ? '🏆 WIN' : '❌ LOSS';

        row.innerHTML = `
            <td>${trade.time.toLocaleTimeString('pt-BR')}</td>
            <td>${trade.asset}</td>
            <td>${trade.direction === 'CALL' ? 'CALL' : 'PUT'}</td>
            <td>R$ ${trade.amount.toFixed(2)}</td>
            <td class="${resultClass}">${resultText}</td>
            <td class="${resultClass}">R$ ${trade.profit.toFixed(2)}</td>
        `;

        while (historyBody.rows.length > 10) historyBody.deleteRow(historyBody.rows.length - 1);
    }

    updateStats() {
        const stats = this.strategies.getStats();
        document.getElementById('balance').textContent = `R$ ${(this.api.balance + this.sessionProfit).toFixed(2)}`;
        document.getElementById('profitLoss').textContent = `R$ ${this.sessionProfit.toFixed(2)}`;
        document.getElementById('winRate').textContent = `${stats.winRate}%`;
    }

    startUpdatingData() {
        setInterval(() => {
            this.updateChartData();
            this.updateAnalysis();
            this.updateStats();
        }, 5000);
    }

    updateChartData() {
        const asset = document.getElementById('asset').value;
        const candles = this.api.getCandles(asset);

        if (candles.length > 0) {
            this.priceData = candles.map(c => c.close);
            this.timeLabels = candles.map((c, i) => i % 5 === 0 ? '' : '');
            if (this.chart) {
                this.chart.data.labels = this.timeLabels;
                this.chart.data.datasets[0].data = this.priceData;
                this.chart.update('none');
            }
        }
    }

    updateAnalysis() {
        const asset = document.getElementById('asset').value;
        const candles = this.api.getCandles(asset);

        if (candles.length > 0) {
            const analysis = this.analysis.analyzeAsset(candles, asset);
            document.getElementById('supportResistance').innerHTML = `
                <strong>Preço:</strong> ${analysis.supportResistance.currentPrice}<br>
                <strong>Suporte:</strong> ${analysis.supportResistance.support.sr}<br>
                <strong>Resistência:</strong> ${analysis.supportResistance.resistance.sr}<br>
                <em>${analysis.supportResistance.interpretation}</em>
            `;
            document.getElementById('trend').innerHTML = `
                <strong>Tipo:</strong> ${analysis.trend.type}<br>
                <strong>Força:</strong> ${analysis.trend.strength}<br>
                <strong>ADX:</strong> ${analysis.trend.adxValue}<br>
                <em>${analysis.trend.interpretation}</em>
            `;
            document.getElementById('volumes').innerHTML = `
                <strong>Ratio:</strong> ${analysis.volumes.ratio}<br>
                <strong>Interpretação:</strong> ${analysis.volumes.interpretation}<br>
                <strong>Recomendações:</strong> ${analysis.volumes.recommendation}
            `;
            const patternsHTML = analysis.patterns.patterns.length > 0
                ? analysis.patterns.patterns.map(p => `<p>🎯 <strong>${p.name}</strong> (${p.strength})</p>`).join('')
                : '<p>Nenhum padrão detectado</p>';
            document.getElementById('patterns').innerHTML = `${patternsHTML}<h5>${analysis.patterns.recommendation}</h5>`;
        }
    }

    handleLogout() {
        this.stopRobot();
        this.api.logout();
        document.getElementById('dashboardSection').classList.remove('active');
        document.getElementById('analysisSection').classList.remove('active');
        document.getElementById('loginSection').classList.add('active');
        const loginForm = document.getElementById('loginForm');
        if (loginForm) loginForm.reset();
        alert('Desconectado!');
    }
}

// Inicializar aplicação
let robot;
document.addEventListener('DOMContentLoaded', () => {
    robot = new TraderRobot();
    console.log('🤖 Robô Trader Mobile Iniciado com WebSocket!');
});
