// IQOption API Integration
class IQOptionAPI {
    constructor() {
        this.isConnected = false;
        this.userId = null;
        this.balance = 0;
        this.sessionId = null;
        this.baseURL = 'https://onrender.com';
        this.wsURL = 'wss://://iqoption.com';
        this.ws = null;
        this.priceHistory = {};
        this.candles = {};
        
        // Dados temporários para autenticar após o onopen
        this.tempEmail = null;
        this.tempPassword = null;
        this.tempAccountType = 'real';
    }

    // Aciona o fluxo de conexão direta via WebSocket
    async login(email, password, accountType = 'REAL') {
        try {
            this.tempEmail = email;
            this.tempPassword = password;
            this.tempAccountType = accountType.toLowerCase();

            console.log("Iniciando conexão direta via WebSocket para login...");
            this.connectWebSocket();

            return { success: true, message: "Conectando ao servidor..." };
        } catch (error) {
            console.error("Erro ao iniciar login:", error);
            return { success: false, message: error.message };
        }
    }

    connectWebSocket() {
        try {
            this.ws = new WebSocket(this.wsURL);

            this.ws.onopen = () => {
                console.log('WebSocket conectado! Enviando credenciais...');
                
                const authMessage = {
                    name: "authenticate",
                    msg: {
                        password: this.tempPassword,
                        email: this.tempEmail,
                        protocol: 3
                    }
                };
                this.ws.send(JSON.stringify(authMessage));
            };

            this.ws.onmessage = (event) => {
                this.handleWebSocketMessage(event.data);
            };

            this.ws.onerror = (error) => {
                console.error('Erro no WebSocket:', error);
            };

            this.ws.onclose = () => {
                console.log('WebSocket desconectado!');
                this.isConnected = false;
                setTimeout(() => this.connectWebSocket(), 5000);
            };
        } catch (error) {
            console.error('Erro ao conectar WebSocket:', error);
        }
    }

    subscribeToAssets() {
        const assets = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCAD', 'BTCUSD'];
        const message = {
            name: "subscribe",
            params: {
                routingFilters: {
                    active_id: assets
                }
            }
        };
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    handleWebSocketMessage(messageData) {
        try {
            const data = JSON.parse(messageData);

            // Captura a resposta de sucesso de login
            if (data.name === "profile" && data.msg) {
                console.log("Autenticação aceita pela IQ Option!");
                this.isConnected = true;
                this.userId = data.msg.user_id;
                this.balance = data.msg.balance;
                this.sessionId = data.msg.ssid;

                localStorage.setItem('iqoption_session', JSON.stringify({
                    sessionId: this.sessionId,
                    userId: this.userId,
                    email: this.tempEmail,
                    accountType: this.tempAccountType
                }));

                this.subscribeToAssets();

                // Executa a função global de sucesso na interface
                if (typeof window.onLoginSuccess === 'function') {
                    window.onLoginSuccess(data.msg);
                }
            }

            // Captura o fluxo contínuo de velas
            if (data.data && data.data.candles) {
                const candles = data.data.candles;
                const assetId = data.data.active_id;
                if (!this.candles[assetId]) {
                    this.candles[assetId] = [];
                }
                this.candles[assetId].push(...candles);

                if (this.candles[assetId].length > 100) {
                    this.candles[assetId] = this.candles[assetId].slice(-100);
                }
            }
        } catch (error) {
            console.error('Erro ao processar mensagem do WebSocket:', error);
        }
    }

    async getPriceHistory(asset, timeframe, count = 100) {
        try {
            const response = await fetch(`${this.baseURL}v1.0/candles/history`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.sessionId}`
                },
                body: JSON.stringify({
                    active_id: this.getAssetId(asset),
                    period: this.getTimeframePeriod(timeframe),
                    size: count,
                    right_edge: Math.floor(Date.now() / 1000)
                })
            });

            const data = await response.json();
            if (data.isSuccessful) {
                this.candles[asset] = data.data.candles || [];
                return data.data.candles || [];
            }
        } catch (error) {
            console.error('Erro ao obter histórico:', error);
        }
        return [];
    }

    getAssetId(asset) {
        const assetMap = { 'EURUSD': 1, 'GBPUSD': 2, 'USDJPY': 3, 'USDCAD': 4, 'BTCUSD': 7 };
        return assetMap[asset] || 1;
    }

    getTimeframePeriod(timeframe) {
        const periodMap = { 'M1': 60, 'M5': 300 };
        return periodMap[timeframe] || 60;
    }

    async placeBet(asset, direction, amount, expiration) {
        try {
            const response = await fetch(`${this.baseURL}v1.0/place-digital-option`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.sessionId}`
                },
                body: JSON.stringify({
                    user_balance_id: this.userId,
                    active_id: this.getAssetId(asset),
                    direction: direction.toUpperCase(),
                    amount: amount,
                    expiration_period: expiration
                })
            });

            const data = await response.json();
            if (data.isSuccessful) {
                return { success: true, data: data };
            } else {
                return { success: false, message: data.message || "Erro ao colocar operação" };
            }
        } catch (error) {
            console.error('Erro na operação:', error);
            return { success: false, message: error.message };
        }
    }

    async getBalance() {
        try {
            const response = await fetch(`${this.baseURL}v1.0/profile`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${this.sessionId}` }
            });

            const data = await response.json();
            if (data.isSuccessful) {
                this.balance = data.profile.balance;
                return this.balance;
            }
        } catch (error) {
            console.error('Erro ao obter saldo:', error);
        }
        return this.balance;
    }

    isLoggedIn() {
        return this.isConnected && this.sessionId !== null;
    }

    logout() {
        if (this.ws) this.ws.close();
        this.isConnected = false;
        this.sessionId = null;
        localStorage.removeItem('iqoption_session');
    }

    restoreSession() {
        const session = localStorage.getItem('iqoption_session');
        if (session) {
            const data = JSON.parse(session);
            this.sessionId = data.sessionId;
            this.userId = data.userId;
            this.isConnected = true;
            this.connectWebSocket();
            return true;
        }
        return false;
    }

    getCandles(asset) {
        return this.candles[asset] || [];
    }

    async simulateBet(asset, direction, amount, expiration) {
        const isWin = Math.random() < 0.7;
        return new Promise((resolve) => {
            setTimeout(() => {
                if (isWin) {
                    this.balance += amount;
                    resolve({ success: true, result: 'WIN', payout: amount, newBalance: this.balance });
                } else {
                    this.balance -= amount;
                    resolve({ success: true, result: 'LOSS', payout: -amount, newBalance: this.balance });
                }
            }, expiration * 1000);
        });
    }
}
