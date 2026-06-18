// ===== IQOption API - Wrapper Seguro =====
class IQOptionAPIWrapper {
    constructor() {
        this.isConnected = false;
        this.userId = null;
        this.balance = 0;
        this.sessionId = null;
        this.priceHistory = {};
        this.candles = {};
        this.ws = null;
        this.apiKey = null;
        this.accountType = 'REAL';
    }

    // Login seguro na IQOption (requer IQOptionAPI npm package)
    async login(email, password, accountType = 'REAL') {
        try {
            // Usar fetch para enviar ao backend que possui a API segura
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email,
                    password: password,
                    account_type: accountType
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.success || data.sessionData) {
                this.isConnected = true;
                this.userId = data.sessionData?.userId || data.user_id;
                this.balance = data.sessionData?.balance || data.balance || 0;
                this.sessionId = data.sessionData?.sessionData || data.session;
                this.accountType = accountType;
                
                // Salvar sessão localmente
                localStorage.setItem('iqoption_session', JSON.stringify({
                    sessionId: this.sessionId,
                    userId: this.userId,
                    email: email,
                    accountType: accountType,
                    balance: this.balance
                }));

                console.log('✅ Conectado com sucesso na IQOption!');
                return { success: true, data: data };
            } else {
                return { success: false, message: data.message || 'Erro ao conectar' };
            }
        } catch (error) {
            console.error('❌ Erro ao fazer login:', error);
            return { success: false, message: error.message };
        }
    }

    // Restaurar sessão anterior
    restoreSession() {
        const session = localStorage.getItem('iqoption_session');
        if (session) {
            const data = JSON.parse(session);
            this.sessionId = data.sessionId;
            this.userId = data.userId;
            this.balance = data.balance;
            this.accountType = data.accountType;
            this.isConnected = true;
            console.log('📱 Sessão restaurada!');
            return true;
        }
        return false;
    }

    // Obter dados de preço do servidor
    async getPriceHistory(asset, timeframe, count = 100) {
        try {
            const response = await fetch(`/api/candles/${asset}?timeframe=${timeframe}&count=${count}`, {
                headers: {
                    'Authorization': `Bearer ${this.sessionId}`
                }
            });

            if (!response.ok) {
                throw new Error(`Erro ao obter histórico: ${response.status}`);
            }

            const data = await response.json();
            this.candles[asset] = data.candles || [];
            return data.candles || [];
        } catch (error) {
            console.error('❌ Erro ao obter histórico de preços:', error);
            // Retornar dados simulados em caso de erro
            return this.simulatePriceData(asset);
        }
    }

    // Simular dados de preço (fallback)
    simulatePriceData(asset) {
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

    // Colocar operação (BUY/SELL)
    async placeBet(asset, direction, amount, expiration) {
        try {
            const response = await fetch('/api/trades/place', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.sessionId}`
                },
                body: JSON.stringify({
                    userId: this.userId,
                    asset: asset,
                    direction: direction,
                    amount: amount,
                    expiration: expiration,
                    accountType: this.accountType
                })
            });

            if (!response.ok) {
                throw new Error(`Erro ao colocar operação: ${response.status}`);
            }

            const data = await response.json();
            return { success: true, data: data };
        } catch (error) {
            console.error('❌ Erro ao colocar operação:', error);
            return { success: false, message: error.message };
        }
    }

    // Obter saldo atual
    async getBalance() {
        try {
            const response = await fetch('/api/profile/balance', {
                headers: {
                    'Authorization': `Bearer ${this.sessionId}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.balance = data.balance || this.balance;
                return this.balance;
            }
        } catch (error) {
            console.error('❌ Erro ao obter saldo:', error);
        }
        return this.balance;
    }

    // Obter últimos candles
    getCandles(asset) {
        return this.candles[asset] || [];
    }

    // Verificar se está conectado
    isLoggedIn() {
        return this.isConnected && this.sessionId !== null;
    }

    // Logout
    logout() {
        this.isConnected = false;
        this.sessionId = null;
        this.userId = null;
        localStorage.removeItem('iqoption_session');
        console.log('🛑 Desconectado');
    }

    // Obter ID do ativo
    getAssetId(asset) {
        const assetMap = {
            'EURUSD': 1,
            'GBPUSD': 2,
            'USDJPY': 3,
            'USDCAD': 4,
            'BTCUSD': 7
        };
        return assetMap[asset] || 1;
    }
}