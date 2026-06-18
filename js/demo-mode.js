// ===== MODO DEMO DO ROBÔ =====
// Este arquivo contém todas as funções necessárias para testar o robô sem conectar na IQOption real

class DemoMode {
    constructor() {
        this.balance = 10000; // Saldo inicial DEMO
        this.trades = [];
        this.isDemo = true;
    }

    // Simular login
    async simulateLogin(email, password, accountType) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    success: true,
                    message: 'Login simulado com sucesso!',
                    data: {
                        user_id: 'demo_' + Date.now(),
                        email: email,
                        balance: this.balance,
                        account_type: accountType,
                        session: 'demo_session_' + Math.random()
                    }
                });
            }, 1000);
        });
    }

    // Simular coleta de dados de preço
    async simulatePriceData(asset) {
        const basePrice = {
            'EURUSD': 1.0850,
            'GBPUSD': 1.2650,
            'USDJPY': 110.50,
            'USDCAD': 1.2550,
            'BTCUSD': 42000
        };

        const base = basePrice[asset] || 1.0;
        const candles = [];

        for (let i = 0; i < 50; i++) {
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
                time: Date.now() - (50 - i) * 60000
            });
        }

        return candles;
    }

    // Simular execução de trade
    async simulateTrade(asset, direction, amount, expiration) {
        return new Promise((resolve) => {
            setTimeout(() => {
                // 70% de chance de ganhar
                const isWin = Math.random() < 0.7;

                if (isWin) {
                    this.balance += amount;
                } else {
                    this.balance -= amount;
                }

                const trade = {
                    asset,
                    direction,
                    amount,
                    result: isWin ? 'WIN' : 'LOSS',
                    profit: isWin ? amount : -amount,
                    time: new Date().toLocaleTimeString('pt-BR'),
                    timestamp: new Date()
                };

                this.trades.push(trade);

                resolve({
                    success: true,
                    trade: trade,
                    newBalance: this.balance
                });
            }, expiration * 1000);
        });
    }

    // Obter histórico
    getHistory() {
        return this.trades;
    }

    // Resetar DEMO
    reset() {
        this.balance = 10000;
        this.trades = [];
    }
}

// Instância global
const demoMode = new DemoMode();