// Estratégias de Price Action
class PriceActionStrategies {
    constructor() {
        this.trades = [];
        this.stats = {
            wins: 0,
            losses: 0,
            totalProfit: 0
        };
    }

    // ===== PRICE ACTION FLUXO (SEGUIDOR DE TENDÊNCIA) =====
    analyzeFluxo(candles) {
        if (candles.length < 10) return null;

        const closes = candles.map(c => c.close);
        const highs = candles.map(c => c.high);
        const lows = candles.map(c => c.low);

        // Calcular médias móveis
        const ma5 = this.simpleMovingAverage(closes, 5);
        const ma10 = this.simpleMovingAverage(closes, 10);

        // Calcular suporte e resistência
        const { support, resistance } = this.calculateSupportResistance(highs, lows);

        // Analisar volume (se disponível)
        const volumes = candles.map(c => c.volume || 1);
        const avgVolume = volumes.slice(-5).reduce((a, b) => a + b) / 5;
        const currentVolume = volumes[volumes.length - 1];

        const currentPrice = closes[closes.length - 1];
        const previousPrice = closes[closes.length - 2];

        let direction = null;
        let signal = null;
        let confidence = 0;

        // Sinal de COMPRA (Uptrend)
        if (ma5 > ma10 && currentPrice > resistance) {
            direction = 'CALL'; // Subida
            signal = 'FLUXO_ALTISTA';
            confidence = this.calculateConfidence({
                trendStrength: (ma5 - ma10) / ma10 * 100,
                volumeRatio: currentVolume / avgVolume,
                priceAboveResistance: (currentPrice - resistance) / resistance * 100
            });
        }
        // Sinal de VENDA (Downtrend)
        else if (ma5 < ma10 && currentPrice < support) {
            direction = 'PUT'; // Queda
            signal = 'FLUXO_BEARISTA';
            confidence = this.calculateConfidence({
                trendStrength: (ma10 - ma5) / ma10 * 100,
                volumeRatio: currentVolume / avgVolume,
                priceBelowSupport: (support - currentPrice) / support * 100
            });
        }

        return {
            direction,
            signal,
            confidence,
            price: currentPrice,
            support,
            resistance,
            ma5,
            ma10,
            volume: currentVolume
        };
    }

    // ===== PRICE ACTION REVERSÃO (INVERSÃO DE TENDÊNCIA) =====
    analyzeReversao(candles) {
        if (candles.length < 20) return null;

        const closes = candles.map(c => c.close);
        const highs = candles.map(c => c.high);
        const lows = candles.map(c => c.low);

        // RSI para identificar sobrecompra/sobrevenda
        const rsi = this.calculateRSI(closes, 14);

        // Padrão Engulfing
        const engulfingPattern = this.detectEngulfing(candles.slice(-5));

        // Padrão Hammer/Inverse Hammer
        const hammerPattern = this.detectHammer(candles.slice(-3));

        // Divergência
        const divergence = this.detectDivergence(candles.slice(-10));

        const currentPrice = closes[closes.length - 1];
        const previousPrice = closes[closes.length - 2];

        let direction = null;
        let signal = null;
        let confidence = 0;

        // Sinal de REVERSÃO para CIMA
        if (rsi < 30 && hammerPattern.found && previousPrice < currentPrice) {
            direction = 'CALL'; // Subida
            signal = 'REVERSAO_ALTISTA';
            confidence = this.calculateConfidence({
                rsiOverSold: 30 - rsi,
                hammerPattern: hammerPattern.strength,
                priceIncrease: (currentPrice - previousPrice) / previousPrice * 100
            });
        }
        // Sinal de REVERSÃO para BAIXO
        else if (rsi > 70 && engulfingPattern.found && previousPrice > currentPrice) {
            direction = 'PUT'; // Queda
            signal = 'REVERSAO_BEARISTA';
            confidence = this.calculateConfidence({
                rsiOverBought: rsi - 70,
                engulfingPattern: engulfingPattern.strength,
                priceDecrease: (previousPrice - currentPrice) / previousPrice * 100
            });
        }

        return {
            direction,
            signal,
            confidence,
            price: currentPrice,
            rsi,
            engulfingPattern,
            hammerPattern,
            divergence
        };
    }

    // ===== ESTRATÉGIA HÍBRIDA =====
    analyzeHibrida(candles) {
        const fluxo = this.analyzeFluxo(candles);
        const reversao = this.analyzeReversao(candles);

        // Combinar sinais com pesos
        let direction = null;
        let confidence = 0;

        if (fluxo && fluxo.direction && reversao && reversao.direction) {
            if (fluxo.direction === reversao.direction) {
                // Sinais concordam - maior confiança
                direction = fluxo.direction;
                confidence = (fluxo.confidence + reversao.confidence) / 2;
            } else {
                // Sinais discordam - usar o de maior confiança
                if (fluxo.confidence > reversao.confidence) {
                    direction = fluxo.direction;
                    confidence = fluxo.confidence;
                } else {
                    direction = reversao.direction;
                    confidence = reversao.confidence;
                }
            }
        } else if (fluxo && fluxo.direction) {
            direction = fluxo.direction;
            confidence = fluxo.confidence;
        } else if (reversao && reversao.direction) {
            direction = reversao.direction;
            confidence = reversao.confidence;
        }

        return {
            direction,
            signal: 'HIBRIDA',
            confidence,
            fluxo,
            reversao
        };
    }

    // ===== FUNÇÕES AUXILIARES =====

    // Média Móvel Simples
    simpleMovingAverage(values, period) {
        if (values.length < period) return values[values.length - 1];
        return values.slice(-period).reduce((a, b) => a + b) / period;
    }

    // RSI (Relative Strength Index)
    calculateRSI(values, period = 14) {
        if (values.length < period) return 50;

        let gains = 0;
        let losses = 0;

        for (let i = values.length - period; i < values.length; i++) {
            const change = values[i] - values[i - 1];
            if (change > 0) gains += change;
            else losses += Math.abs(change);
        }

        const avgGain = gains / period;
        const avgLoss = losses / period;

        if (avgLoss === 0) return avgGain > 0 ? 100 : 0;

        const rs = avgGain / avgLoss;
        const rsi = 100 - (100 / (1 + rs));

        return rsi;
    }

    // Suporte e Resistência
    calculateSupportResistance(highs, lows, period = 20) {
        const recentHighs = highs.slice(-period);
        const recentLows = lows.slice(-period);

        const resistance = Math.max(...recentHighs);
        const support = Math.min(...recentLows);

        return { support, resistance };
    }

    // Padrão Engulfing
    detectEngulfing(candles) {
        if (candles.length < 2) return { found: false };

        const current = candles[candles.length - 1];
        const previous = candles[candles.length - 2];

        // Bullish Engulfing
        if (previous.close <= previous.open &&
            current.close > current.open &&
            current.close > previous.open &&
            current.open < previous.close) {
            return {
                found: true,
                type: 'BULLISH',
                strength: 0.8
            };
        }

        // Bearish Engulfing
        if (previous.close >= previous.open &&
            current.close < current.open &&
            current.close < previous.open &&
            current.open > previous.close) {
            return {
                found: true,
                type: 'BEARISH',
                strength: 0.8
            };
        }

        return { found: false };
    }

    // Padrão Hammer
    detectHammer(candles) {
        if (candles.length < 1) return { found: false };

        const candle = candles[candles.length - 1];
        const body = Math.abs(candle.close - candle.open);
        const lower_shadow = Math.min(candle.open, candle.close) - candle.low;
        const upper_shadow = candle.high - Math.max(candle.open, candle.close);

        // Hammer: sombra inferior > 2x corpo
        if (lower_shadow > body * 2 && upper_shadow < body * 0.5) {
            return {
                found: true,
                type: 'HAMMER',
                strength: 0.75
            };
        }

        // Inverse Hammer
        if (upper_shadow > body * 2 && lower_shadow < body * 0.5) {
            return {
                found: true,
                type: 'INVERSE_HAMMER',
                strength: 0.75
            };
        }

        return { found: false };
    }

    // Detectar Divergência
    detectDivergence(candles) {
        if (candles.length < 5) return { found: false };

        const closes = candles.map(c => c.close);
        const rsis = [];

        for (let i = 0; i < closes.length - 1; i++) {
            rsis.push(this.calculateRSI(closes.slice(0, i + 2), 5));
        }

        // Divergência de alta
        if (closes[closes.length - 1] < closes[closes.length - 2] &&
            rsis[rsis.length - 1] > rsis[rsis.length - 2]) {
            return { found: true, type: 'BULLISH_DIVERGENCE' };
        }

        // Divergência de baixa
        if (closes[closes.length - 1] > closes[closes.length - 2] &&
            rsis[rsis.length - 1] < rsis[rsis.length - 2]) {
            return { found: true, type: 'BEARISH_DIVERGENCE' };
        }

        return { found: false };
    }

    // Calcular confiança da estratégia
    calculateConfidence(factors) {
        let confidence = 0.5; // Base 50%

        Object.values(factors).forEach(factor => {
            if (typeof factor === 'number') {
                confidence += Math.min(factor / 100, 0.25);
            }
        });

        return Math.min(confidence * 100, 100);
    }

    // Registrar trade
    recordTrade(trade) {
        this.trades.push({
            ...trade,
            timestamp: new Date()
        });

        if (trade.result === 'WIN') {
            this.stats.wins++;
            this.stats.totalProfit += trade.payout;
        } else {
            this.stats.losses++;
            this.stats.totalProfit -= trade.payout;
        }
    }

    // Obter estatísticas
    getStats() {
        const total = this.stats.wins + this.stats.losses;
        const winRate = total > 0 ? (this.stats.wins / total * 100).toFixed(2) : 0;

        return {
            wins: this.stats.wins,
            losses: this.stats.losses,
            total,
            winRate: parseFloat(winRate),
            totalProfit: this.stats.totalProfit.toFixed(2),
            trades: this.trades
        };
    }
}