// ===== IQOption API Wrapper =====
class IQOptionAPIWrapper {
    constructor() {
        this.isConnected = false;
        this.userId      = null;
        this.balance     = 0;
        this.sessionId   = null;
        this.accountType = 'PRACTICE';
        this.candlesCache = {};
    }

    async login(email, password, accountType = 'PRACTICE') {
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, account_type: accountType })
            });

            const data = await response.json();

            if (!response.ok) {
                return { success: false, message: data.message || `Erro HTTP ${response.status}` };
            }

            if (data.success && data.sessionData) {
                this.isConnected = true;
                this.userId      = data.sessionData.userId;
                this.balance     = data.sessionData.balance || 0;
                this.sessionId   = data.sessionData.session || data.sessionData.sessionData;
                this.accountType = data.sessionData.accountType || 'PRACTICE';
                this.accountWarning = data.sessionData.accountWarning || null;
                console.log('✅ Conectado! Conta:', this.accountType, '| Saldo:', this.balance);
                return { success: true };
            }

            return { success: false, message: data.message || 'Falha ao conectar' };
        } catch (error) {
            console.error('Erro login:', error);
            return { success: false, message: 'Erro de conexão: ' + error.message };
        }
    }

    async getBalance() {
        const response = await fetch('/api/profile/balance', {
            headers: { 'Authorization': `Bearer ${this.sessionId}` }
        });
        if (!response.ok) throw new Error(`Erro HTTP ${response.status}`);
        const data = await response.json();
        this.balance     = data.balance ?? this.balance;
        this.accountType = data.accountType ?? this.accountType;
        return this.balance;
    }

    async switchAccount(targetType) {
        try {
            const response = await fetch('/api/account/switch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.sessionId}`
                },
                body: JSON.stringify({ account_type: targetType })
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                return { success: false, message: data.message || `Erro HTTP ${response.status}` };
            }
            this.accountType = data.accountType;
            this.balance     = data.balance ?? this.balance;
            return { success: true };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    async getPriceHistory(asset, timeframe, count = 50) {
        const response = await fetch(`/api/candles/${asset}?timeframe=${timeframe}&count=${count}`, {
            headers: { 'Authorization': `Bearer ${this.sessionId}` }
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || `Erro HTTP ${response.status}`);
        }
        const data = await response.json();
        const candles = data.candles || [];
        this.candlesCache[asset] = candles;
        return candles;
    }

    async placeBet(asset, direction, amount, expiration) {
        try {
            const response = await fetch('/api/trades/place', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.sessionId}`
                },
                body: JSON.stringify({ asset, direction, amount, expiration })
            });
            const data = await response.json();
            if (!response.ok) return { success: false, message: data.message || `Erro HTTP ${response.status}` };
            return { success: true, data };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    async checkTradeResult(orderId, durationSeconds) {
        // Aguarda o tempo de expiração + 15s de tolerância
        const waitMs = (durationSeconds || 60) * 1000;
        await new Promise(resolve => setTimeout(resolve, waitMs));

        const response = await fetch(`/api/trades/result/${orderId}?timeoutMs=15000`, {
            headers: { 'Authorization': `Bearer ${this.sessionId}` }
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.message || `Erro HTTP ${response.status}`);
        }
        return await response.json();
    }

    getCandles(asset) {
        return this.candlesCache[asset] || [];
    }

    isLoggedIn() {
        return this.isConnected && !!this.sessionId;
    }

    logout() {
        fetch('/api/logout', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.sessionId}` }
        }).catch(() => {});
        this.isConnected = false;
        this.sessionId   = null;
        this.userId      = null;
        this.balance     = 0;
        this.candlesCache = {};
    }
}

// Alias para compatibilidade
const IQOptionAPI = IQOptionAPIWrapper;
