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
    }

    initEventListeners() {
        // Login
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Robot Controls
        document.getElementById('startBtn').addEventListener('click', () => this.startRobot());
        document.getElementById('stopBtn').addEventListener('click', () => this.stopRobot());
        document.getElementById('logoutBtn').addEventListener('click', () => this.handleLogout());
    }

    // ===== LOGIN =====
    async handleLogin() {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const accountType = document.getElementById('accountType').value;

        if (!email || !password) {
            alert('Por favor, preencha email e senha');
            return;
        }

        try {
            const result = await this.api.login(email, password, accountType);
            
            if (result.success) {
                this.showDashboard();
                this.updateUserInfo();
                alert('✅ Conectado com sucesso!');
            } else {
                alert('❌ Erro: ' + result.message);
            }
        } catch (error) {
            alert('Erro ao conectar: ' + error.message);
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
        document.getElementById('userInfo').innerHTML = `
            <span>🟢 Conectado | ${accountType} | Saldo: R$ ${this.api.balance.toFixed(2)}</span>
        `;
    }

    // ===== CHART =====
    initChart() {
        const ctx = document.getElementById('priceChart').getContext('2d');
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.timeLabels,
                datasets: [{
                    label: 'Preço',
                    data: this.priceData,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointBackgroundColor: '#667eea'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false
                    }
                }
            }
        });
    }

    // ===== ROBOT LOGIC =====
    async startRobot() {
        const initialBet = parseFloat(document.getElementById('initialBet').value);
        const stopWin = parseFloat(document.getElementById('stopWin').value);
        const stopLoss = parseFloat(document.getElementById('stopLoss').value);

        if (this.sessionProfit >= stopWin) {
            alert('✅ Stop Win atingido! Robô parado.');
            return;
        }

        if (this.sessionProfit <= -stopLoss) {
            alert('❌ Stop Loss atingido! Robô parado.');
            return;
        }

        this.isRunning = true;
        document.getElementById('startBtn').disabled = true;
        document.getElementById('stopBtn').disabled = false;

        while (this.isRunning) {
            await this.executeTrade(initialBet);
            await new Promise(resolve => setTimeout(resolve, 5000)); // Aguardar 5 segundos
        }
    }

    async executeTrade(baseAmount) {
        const asset = document.getElementById('asset').value;
        const strategy = document.getElementById('strategy').value;
        const timeframe = document.getElementById('timeframe').value;
        const expiration = parseInt(document.getElementById('expiration').value);
        const martingale = parseFloat(document.getElementById('martingale').value);

        try {
            // Obter dados de preço
            const candles = await this.api.getPriceHistory(asset, timeframe, 50);
            
            if (candles.length === 0) {
                console.log('Sem dados de preço');
                return;
            }

            // Analisar estratégia
            let signal = null;
            if (strategy === 'fluxo') {
                signal = this.strategies.analyzeFluxo(candles);
            } else if (strategy === 'reversao') {
                signal = this.strategies.analyzeReversao(candles);
            } else if (strategy === 'hibrida') {
                signal = this.strategies.analyzeHibrida(candles);
            }

            if (!signal || !signal.direction) {
                console.log('Sem sinal claro');
                return;
            }

            // Calcular entrada com martingale
            const tradeAmount = this.martingaleCount > 0 
                ? baseAmount * Math.pow(martingale, this.martingaleCount)
                : baseAmount;

            // Atualizar UI
            this.updateTradeInfo(signal, tradeAmount, asset);

            // Colocar operação
            const result = await this.api.placeBet(asset, signal.direction, tradeAmount, expiration);

            if (result.success) {
                this.currentTrade = {
                    asset,
                    direction: signal.direction,
                    amount: tradeAmount,
                    price: signal.price,
                    time: new Date(),
                    signal: signal.signal,
                    confidence: signal.confidence
                };

                // Simular resultado (em produção, aguardar resultado real)
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
            this.martingaleCount = 0; // Reset martingale
            this.strategies.stats.wins++;
        } else {
            this.sessionProfit -= amount;
            this.martingaleCount++; // Próxima entrada será martingale
            this.strategies.stats.losses++;
        }

        // Registrar trade
        const trade = {
            time: new Date(),
            asset: this.currentTrade.asset,
            direction: this.currentTrade.direction,
            amount,
            result,
            profit: result === 'WIN' ? amount : -amount
        };

        this.trades.push(trade);
        this.updateTradeHistory(trade);
        this.updateStats();

        // Verificar Stop Win/Loss
        const stopWin = parseFloat(document.getElementById('stopWin').value);
        const stopLoss = parseFloat(document.getElementById('stopLoss').value);

        if (this.sessionProfit >= stopWin) {
            alert('✅ Stop Win atingido! Robô parado.');
            this.stopRobot();
        } else if (this.sessionProfit <= -stopLoss) {
            alert('❌ Stop Loss atingido! Robô parado.');
            this.stopRobot();
        }
    }

    stopRobot() {
        this.isRunning = false;
        document.getElementById('startBtn').disabled = false;
        document.getElementById('stopBtn').disabled = true;
        alert('Robô parado!');
    }

    // ===== UI UPDATES =====
    updateTradeInfo(signal, amount, asset) {
        document.getElementById('tradeStatus').textContent = '🔄 Em execução...';
        document.getElementById('tradeEntry').textContent = `R$ ${amount.toFixed(2)}`;
        document.getElementById('tradeDirection').textContent = signal.direction === 'CALL' ? '📈 SUBIDA' : '📉 QUEDA';
        document.getElementById('tradePrice').textContent = signal.price.toFixed(4);
        document.getElementById('tradeTime').textContent = new Date().toLocaleTimeString('pt-BR');
        document.getElementById('tradeMartingale').textContent = this.martingaleCount;
    }

    updateTradeHistory(trade) {
        const historyBody = document.getElementById('historyBody');
        const row = historyBody.insertRow(0);
        
        const resultClass = trade.result === 'WIN' ? 'win' : 'loss';
        const resultText = trade.result === 'WIN' ? '✅ WIN' : '❌ LOSS';
        
        row.innerHTML = `
            <td>${trade.time.toLocaleTimeString('pt-BR')}</td>
            <td>${trade.asset}</td>
            <td>${trade.direction === 'CALL' ? '📈' : '📉'}</td>
            <td>R$ ${trade.amount.toFixed(2)}</td>
            <td class="${resultClass}">${resultText}</td>
            <td class="${resultClass}">R$ ${trade.profit.toFixed(2)}</td>
        `;

        // Manter apenas últimas 20 operações visíveis
        while (historyBody.rows.length > 20) {
            historyBody.deleteRow(historyBody.rows.length - 1);
        }
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
            this.timeLabels = candles.map((c, i) => i % 5 === 0 ? i : '');

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

            // Suporte e Resistência
            document.getElementById('supportResistance').innerHTML = `
                <strong>Preço:</strong> ${analysis.supportResistance.currentPrice}<br>
                <strong>Suporte:</strong> ${analysis.supportResistance.support.s1}<br>
                <strong>Resistência:</strong> ${analysis.supportResistance.resistance.r1}<br>
                <em>${analysis.supportResistance.interpretation}</em>
            `;

            // Tendência
            document.getElementById('trend').innerHTML = `
                <strong>Tipo:</strong> ${analysis.trend.type}<br>
                <strong>Força:</strong> ${analysis.trend.strength}<br>
                <strong>ADX:</strong> ${analysis.trend.adxValue}<br>
                <em>${analysis.trend.interpretation}</em>
            `;

            // Volumes
            document.getElementById('volumes').innerHTML = `
                <strong>Ratio:</strong> ${analysis.volumes.ratio}<br>
                <strong>Interpretação:</strong> ${analysis.volumes.interpretation}<br>
                <strong>Recomendação:</strong> ${analysis.volumes.recommendation}
            `;

            // Padrões
            const patternsHTML = analysis.patterns.patterns.length > 0
                ? analysis.patterns.patterns.map(p => `<p>🔹 ${p.name} (${p.strength})</p>`).join('')
                : '<p>Nenhum padrão detectado</p>';

            document.getElementById('patterns').innerHTML = `
                ${patternsHTML}
                <em>${analysis.patterns.recommendation}</em>
            `;
        }
    }

    // ===== LOGOUT =====
    handleLogout() {
        this.stopRobot();
        this.api.logout();
        document.getElementById('dashboardSection').classList.remove('active');
        document.getElementById('analysisSection').classList.remove('active');
        document.getElementById('loginSection').classList.add('active');
        document.getElementById('loginForm').reset();
        alert('Desconectado!');
    }
}

// Inicializar aplicação
let robot;
document.addEventListener('DOMContentLoaded', () => {
    robot = new TraderRobot();
    console.log('🤖 Robô Trader Mobile iniciado!');
});