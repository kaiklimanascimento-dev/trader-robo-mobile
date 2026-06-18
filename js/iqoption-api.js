// IQOption API Integration
class IQOptionAPI {
    constructor() {
        this.isConnected = false;
        this.userId = null;
        this.balance = 0;
        this.sessionId = null;
        this.baseURL = 'https://iqoption.com/api/';
        this.wsURL = 'wss://iqoption.com/echo/websocket';
        this.ws = null;
        this.priceHistory = {};
        this.candles = {};
    }

    // Login na IQOption
    async login(email, password, accountType = 'REAL') {
        try {
            const response = await fetch(`${this.baseURL}v1.0/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email,
                    password: password,
                    account_type: accountType.toLowerCase()
                })
            });

            const data = await response.json();
            
            if (data.isSuccessful) {
                this.isConnected = true;
                this.userId = data.profile.user_id;
                this.balance = data.profile.balance;
                this.sessionId = data.session;
                localStorage.setItem('iqoption_session', JSON.stringify({
                    sessionId: this.sessionId,
                    userId: this.userId,
                    email: email,
                    accountType: accountType
                }));
                this.connectWebSocket();
                return { success: true, data: data };
            } else {
                return { success: false, message: data.message || 'Erro no login' };
            }
        } catch (error) {
            console.error('Erro ao fazer login:', error);
            return { success: false, message: error.message };
        }
    }

    // Conectar ao WebSocket
    connectWebSocket() {
        try {
            this.ws = new WebSocket(this.wsURL);
            
            this.ws.onopen = () => {
                console.log('WebSocket conectado');
                this.subscribeToAssets();
            };

            this.ws.onmessage = (event) => {
                this.handleWebSocketMessage(event.data);
            };

            this.ws.onerror = (error) => {
                console.error('Erro WebSocket:', error);
            };

            this.ws.onclose = () => {
                console.log('WebSocket desconectado');
                // Reconectar após 5 segundos
                setTimeout(() => this.connectWebSocket(), 5000);
            };
        } catch (error) {
            console.error('Erro ao conectar WebSocket:', error);
        }
    }

    // Subscribe nos ativos
    subscribeToAssets() {
        const assets = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCAD', 'BTCUSD'];
        const message = {
            name: 'subscribe',
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

    // Lidar com mensagens WebSocket
    handleWebSocketMessage(messageData) {
        try {
            const data = JSON.parse(messageData);
            
            if (data.data && data.data.candles) {
                const candles = data.data.candles;
                const assetId = data.data.active_id;
                
                if (!this.candles[assetId]) {
                    this.candles[assetId] = [];
                }
                
                this.candles[assetId].push(...candles);
                
                // Manter apenas os últimos 100 candles
                if (this.candles[assetId].length > 100) {
                    this.candles[assetId] = this.candles[assetId].slice(-100);
                }
            }
        } catch (error) {
            console.error('Erro ao processar mensagem WebSocket:', error);
        }
    }

    // Obter histórico de preços
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
                this.candles[asset] = data.candles || [];
                return data.candles || [];
            }
        } catch (error) {
            console.error('Erro ao obter histórico de preços:', error);
        }
        return [];
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

    // Converter timeframe para período
    getTimeframePeriod(timeframe) {
        const periodMap = {
            'M1': 60,
            'M5': 300
        };
        return periodMap[timeframe] || 60;
    }

    // Colocar operação (BUY/SELL)
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
                return { success: false, message: data.message || 'Erro ao colocar operação' };
            }
        } catch (error) {
            console.error('Erro ao colocar operação:', error);
            return { success: false, message: error.message };
        }
    }

    // Obter saldo atual
    async getBalance() {
        try {
            const response = await fetch(`${this.baseURL}v1.0/profile`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.sessionId}`
                }
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

    // Verificar conexão
    isLoggedIn() {
        return this.isConnected && this.sessionId !== null;
    }

    // Logout
    logout() {
        if (this.ws) {
            this.ws.close();
        }
        this.isConnected = false;
        this.sessionId = null;
        localStorage.removeItem('iqoption_session');
    }

    // Restaurar sessão
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

    // Obter últimos candles
    getCandles(asset) {
        return this.candles[asset] || [];
    }

    // Simular operação (para modo demo/teste)
    async simulateBet(asset, direction, amount, expiration) {
        // Simular resultado aleatório (70% de acerto)
        const isWin = Math.random() < 0.7;
        
        return new Promise((resolve) => {
            setTimeout(() => {
                if (isWin) {
                    this.balance += amount;
                    resolve({ 
                        success: true, 
                        result: 'WIN',
                        payout: amount,
                        newBalance: this.balance 
                    });
                } else {
                    this.balance -= amount;
                    resolve({ 
                        success: true, 
                        result: 'LOSS',
                        payout: -amount,
                        newBalance: this.balance 
                    });
                }
            }, expiration * 1000);
        });
    }
}