// Análise Profissional
class ProfessionalAnalysis {
    constructor() {
        this.analysis = {};
    }

    // Análise Completa de um Ativo
    analyzeAsset(candles, asset) {
        if (candles.length < 20) {
            return {
                supportResistance: 'Dados insuficientes',
                trend: 'Dados insuficientes',
                volumes: 'Dados insuficientes',
                patterns: 'Dados insuficientes'
            };
        }

        return {
            supportResistance: this.analyzeSupportResistance(candles),
            trend: this.analyzeTrend(candles),
            volumes: this.analyzeVolumes(candles),
            patterns: this.analyzePatterns(candles),
            marketStructure: this.analyzeMarketStructure(candles)
        };
    }

    // 1. SUPORTE E RESISTÊNCIA
    analyzeSupportResistance(candles) {
        const highs = candles.map(c => c.high);
        const lows = candles.map(c => c.low);
        const closes = candles.map(c => c.close);

        // Últimos 50 candles para análise
        const recentHighs = highs.slice(-50);
        const recentLows = lows.slice(-50);

        // Encontrar pivots
        const pivots = this.findPivots(recentHighs, recentLows);

        const currentPrice = closes[closes.length - 1];
        const resistance1 = this.findNearestResistance(recentHighs, currentPrice);
        const support1 = this.findNearestSupport(recentLows, currentPrice);

        return {
            currentPrice: currentPrice.toFixed(4),
            support: {
                s1: support1.toFixed(4),
                s2: (support1 - (resistance1 - support1)).toFixed(4)
            },
            resistance: {
                r1: resistance1.toFixed(4),
                r2: (resistance1 + (resistance1 - support1)).toFixed(4)
            },
            pivotPoints: pivots,
            interpretation: this.interpretSupportResistance(currentPrice, support1, resistance1)
        };
    }

    // 2. ANÁLISE DE TENDÊNCIA
    analyzeTrend(candles) {
        const closes = candles.map(c => c.close);
        const highs = candles.map(c => c.high);
        const lows = candles.map(c => c.low);

        // Médias Móveis
        const ma5 = this.simpleMovingAverage(closes, 5);
        const ma20 = this.simpleMovingAverage(closes, 20);
        const ma50 = this.simpleMovingAverage(closes, 50);

        // Calcular inclinação da tendência
        const slope = this.calculateSlope(closes.slice(-20));

        // MACD
        const macd = this.calculateMACD(closes);

        // ADX (Força da tendência)
        const adx = this.calculateADX(highs, lows, closes);

        const currentPrice = closes[closes.length - 1];

        let trendType = 'LATERAL';
        let trendStrength = 'FRACA';

        if (ma5 > ma20 && ma20 > ma50) {
            trendType = 'ALTISTA (Uptrend)';
            if (adx > 25) trendStrength = 'FORTE';
            else if (adx > 15) trendStrength = 'MODERADA';
        } else if (ma5 < ma20 && ma20 < ma50) {
            trendType = 'BEARISTA (Downtrend)';
            if (adx > 25) trendStrength = 'FORTE';
            else if (adx > 15) trendStrength = 'MODERADA';
        }

        return {
            type: trendType,
            strength: trendStrength,
            adxValue: adx.toFixed(2),
            movingAverages: {
                ma5: ma5.toFixed(4),
                ma20: ma20.toFixed(4),
                ma50: ma50.toFixed(4)
            },
            macd: {
                macdLine: macd.macdLine.toFixed(4),
                signalLine: macd.signalLine.toFixed(4),
                histogram: macd.histogram.toFixed(4)
            },
            slope: slope.toFixed(4),
            interpretation: this.interpretTrend(trendType, trendStrength, adx)
        };
    }

    // 3. ANÁLISE DE VOLUMES
    analyzeVolumes(candles) {
        const volumes = candles.map(c => c.volume || 1);
        const closes = candles.map(c => c.close);

        const currentVolume = volumes[volumes.length - 1];
        const avgVolume = this.simpleMovingAverage(volumes, 20);
        const volumeRatio = (currentVolume / avgVolume * 100).toFixed(2);

        // OBV (On Balance Volume)
        const obv = this.calculateOBV(closes, volumes);

        // Volume Profile
        const volumeProfile = this.analyzeVolumeProfile(candles);

        let volumeInterpretation = 'NORMAL';
        if (volumeRatio > 150) {
            volumeInterpretation = 'ALTO - Possível breakout';
        } else if (volumeRatio < 50) {
            volumeInterpretation = 'BAIXO - Fraco movimento';
        }

        return {
            current: currentVolume,
            average: avgVolume.toFixed(2),
            ratio: volumeRatio + '%',
            obv: obv.toFixed(2),
            interpretation: volumeInterpretation,
            volumeProfile: volumeProfile,
            recommendation: this.getVolumeRecommendation(volumeRatio, obv)
        };
    }

    // 4. PADRÕES PRICE ACTION
    analyzePatterns(candles) {
        const patterns = [];

        // Engulfing
        const engulfing = this.detectEngulfing(candles.slice(-5));
        if (engulfing.found) {
            patterns.push({
                name: `Engulfing ${engulfing.type}`,
                strength: 'Média',
                description: 'Padrão de reversão potencial'
            });
        }

        // Hammer
        const hammer = this.detectHammer(candles.slice(-3));
        if (hammer.found) {
            patterns.push({
                name: `${hammer.type}`,
                strength: 'Média',
                description: 'Sinal de reversão em níveis chave'
            });
        }

        // Inside Bar
        const insideBar = this.detectInsideBar(candles.slice(-2));
        if (insideBar) {
            patterns.push({
                name: 'Inside Bar (Consolidação)',
                strength: 'Média',
                description: 'Possível breakout iminente'
            });
        }

        // Pin Bar
        const pinBar = this.detectPinBar(candles.slice(-3));
        if (pinBar) {
            patterns.push({
                name: 'Pin Bar',
                strength: 'Alta',
                description: 'Rejeição de preço em nível importante'
            });
        }

        return {
            found: patterns.length > 0,
            patterns: patterns,
            recommendation: patterns.length > 0 ? 'Padrões detectados - Esperar confirmação' : 'Nenhum padrão detectado'
        };
    }

    // 5. ESTRUTURA DE MERCADO
    analyzeMarketStructure(candles) {
        const highs = candles.map(c => c.high);
        const lows = candles.map(c => c.low);
        const closes = candles.map(c => c.close);

        // Higher Highs e Higher Lows (Uptrend)
        const hhll = this.checkHigherHighsLowerLows(highs, lows);

        // Breaklevels
        const breaklevels = this.findBreaklevels(highs, lows);

        // Swing Points
        const swingPoints = this.findSwingPoints(closes);

        return {
            structure: hhll.structure,
            breaklevels: breaklevels,
            swingPoints: swingPoints,
            interpretation: this.interpretMarketStructure(hhll.structure)
        };
    }

    // ===== FUNÇÕES AUXILIARES =====

    simpleMovingAverage(values, period) {
        if (values.length < period) return values[values.length - 1];
        return values.slice(-period).reduce((a, b) => a + b) / period;
    }

    exponentialMovingAverage(values, period) {
        if (values.length === 0) return 0;
        const multiplier = 2 / (period + 1);
        let ema = values[0];
        for (let i = 1; i < values.length; i++) {
            ema = (values[i] * multiplier) + (ema * (1 - multiplier));
        }
        return ema;
    }

    calculateMACD(values) {
        const ema12 = this.exponentialMovingAverage(values, 12);
        const ema26 = this.exponentialMovingAverage(values, 26);
        const macdLine = ema12 - ema26;
        
        const macdValues = [];
        for (let i = 0; i < values.length; i++) {
            const ema12i = this.exponentialMovingAverage(values.slice(0, i + 1), 12);
            const ema26i = this.exponentialMovingAverage(values.slice(0, i + 1), 26);
            macdValues.push(ema12i - ema26i);
        }
        
        const signalLine = this.exponentialMovingAverage(macdValues, 9);
        const histogram = macdLine - signalLine;

        return { macdLine, signalLine, histogram };
    }

    calculateADX(highs, lows, closes) {
        const trueRanges = [];
        for (let i = 1; i < highs.length; i++) {
            const tr = Math.max(
                highs[i] - lows[i],
                Math.abs(highs[i] - closes[i - 1]),
                Math.abs(lows[i] - closes[i - 1])
            );
            trueRanges.push(tr);
        }

        const atr = trueRanges.slice(-14).reduce((a, b) => a + b) / 14;

        // Simplificado - ADX real é mais complexo
        const volatility = Math.std(...trueRanges.slice(-14)) || 0.001;
        const adx = (volatility / atr) * 50;

        return Math.min(adx, 100);
    }

    calculateOBV(closes, volumes) {
        let obv = 0;
        for (let i = 0; i < closes.length; i++) {
            if (i === 0) {
                obv = volumes[i];
            } else if (closes[i] > closes[i - 1]) {
                obv += volumes[i];
            } else if (closes[i] < closes[i - 1]) {
                obv -= volumes[i];
            }
        }
        return obv;
    }

    calculateSlope(values) {
        const n = values.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

        for (let i = 0; i < n; i++) {
            sumX += i;
            sumY += values[i];
            sumXY += i * values[i];
            sumX2 += i * i;
        }

        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        return slope;
    }

    findNearestResistance(highs, price) {
        return Math.min(...highs.filter(h => h > price).slice(0, 5)) || Math.max(...highs);
    }

    findNearestSupport(lows, price) {
        return Math.max(...lows.filter(l => l < price).slice(0, 5)) || Math.min(...lows);
    }

    findPivots(highs, lows) {
        const maxHigh = Math.max(...highs);
        const minLow = Math.min(...lows);
        return {
            pivot: ((maxHigh + minLow) / 2).toFixed(4),
            maxHigh: maxHigh.toFixed(4),
            minLow: minLow.toFixed(4)
        };
    }

    detectEngulfing(candles) {
        if (candles.length < 2) return { found: false };
        
        const current = candles[candles.length - 1];
        const previous = candles[candles.length - 2];

        if (previous.close <= previous.open &&
            current.close > current.open &&
            current.close > previous.open &&
            current.open < previous.close) {
            return { found: true, type: 'BULLISH' };
        }

        if (previous.close >= previous.open &&
            current.close < current.open &&
            current.close < previous.open &&
            current.open > previous.close) {
            return { found: true, type: 'BEARISH' };
        }

        return { found: false };
    }

    detectHammer(candles) {
        if (candles.length < 1) return { found: false };
        
        const candle = candles[candles.length - 1];
        const body = Math.abs(candle.close - candle.open);
        const lower_shadow = Math.min(candle.open, candle.close) - candle.low;

        if (lower_shadow > body * 2) {
            return { found: true, type: 'HAMMER' };
        }

        return { found: false };
    }

    detectInsideBar(candles) {
        if (candles.length < 2) return false;
        const prev = candles[0];
        const curr = candles[1];
        return curr.high < prev.high && curr.low > prev.low;
    }

    detectPinBar(candles) {
        if (candles.length < 1) return false;
        const c = candles[candles.length - 1];
        const body = Math.abs(c.close - c.open);
        const totalRange = c.high - c.low;
        return body < totalRange * 0.25;
    }

    checkHigherHighsLowerLows(highs, lows) {
        const recent = { highs: highs.slice(-20), lows: lows.slice(-20) };
        
        let hhCount = 0, llCount = 0;
        for (let i = 1; i < recent.highs.length; i++) {
            if (recent.highs[i] > recent.highs[i - 1]) hhCount++;
            if (recent.lows[i] > recent.lows[i - 1]) llCount++;
        }

        if (hhCount > llCount) return { structure: 'UPTREND' };
        if (llCount > hhCount) return { structure: 'DOWNTREND' };
        return { structure: 'SIDEWAYS' };
    }

    findBreaklevels(highs, lows) {
        return {
            topBreak: Math.max(...highs),
            bottomBreak: Math.min(...lows)
        };
    }

    findSwingPoints(closes) {
        return {
            recent: closes.slice(-5)
        };
    }

    analyzeVolumeProfile(candles) {
        const profile = {};
        candles.forEach(c => {
            const level = Math.round(c.close * 100) / 100;
            profile[level] = (profile[level] || 0) + (c.volume || 1);
        });
        return profile;
    }

    getVolumeRecommendation(ratio, obv) {
        if (ratio > 150 && obv > 0) return 'COMPRA FORTE';
        if (ratio > 150 && obv < 0) return 'VENDA FORTE';
        if (ratio < 50) return 'AGUARDAR MOVIMENTO';
        return 'NEUTRO';
    }

    interpretSupportResistance(price, support, resistance) {
        const distToSupport = ((price - support) / support * 100).toFixed(2);
        const distToResistance = ((resistance - price) / resistance * 100).toFixed(2);
        return `Preço a ${distToSupport}% do suporte e ${distToResistance}% da resistência`;
    }

    interpretTrend(type, strength, adx) {
        return `${type} ${strength}. ADX: ${adx.toFixed(2)}`;
    }

    interpretMarketStructure(structure) {
        const descriptions = {
            'UPTREND': 'Mercado em alta - Procurar compras',
            'DOWNTREND': 'Mercado em queda - Procurar vendas',
            'SIDEWAYS': 'Mercado lateral - Aguardar breakout'
        };
        return descriptions[structure] || 'Estrutura indefinida';
    }
}