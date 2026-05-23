import type { Candle, TechnicalAnalysis } from "@/types"

export function calculateEMA(prices: number[], period: number): number[] {
  if (prices.length < period) return []
  const k = 2 / (period + 1)
  const ema: number[] = []
  let sum = 0
  for (let i = 0; i < period; i++) sum += prices[i]
  ema.push(sum / period)
  for (let i = period; i < prices.length; i++) {
    ema.push(prices[i] * k + ema[ema.length - 1] * (1 - k))
  }
  return ema
}

export function calculateRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50
  let gains = 0
  let losses = 0
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1]
    if (diff > 0) gains += diff
    else losses -= diff
  }
  let avgGain = gains / period
  let avgLoss = losses / period
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1]
    const gain = diff > 0 ? diff : 0
    const loss = diff < 0 ? -diff : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
  }
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

export function calculateMACD(prices: number[]): { macd: number; signal: number; histogram: number } {
  const ema12 = calculateEMA(prices, 12)
  const ema26 = calculateEMA(prices, 26)
  if (ema12.length === 0 || ema26.length === 0) return { macd: 0, signal: 0, histogram: 0 }
  const offset = ema12.length - ema26.length
  const macdLine = ema26.map((v, i) => ema12[i + offset] - v)
  const signalLine = calculateEMA(macdLine, 9)
  const lastMacd = macdLine[macdLine.length - 1]
  const lastSignal = signalLine[signalLine.length - 1] || 0
  return {
    macd: lastMacd,
    signal: lastSignal,
    histogram: lastMacd - lastSignal,
  }
}

export function calculateBollingerBands(
  prices: number[],
  period = 20,
  stdDev = 2
): { upper: number; middle: number; lower: number } {
  if (prices.length < period) {
    const last = prices[prices.length - 1] || 0
    return { upper: last * 1.05, middle: last, lower: last * 0.95 }
  }
  const slice = prices.slice(-period)
  const mean = slice.reduce((a, b) => a + b, 0) / period
  const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period
  const std = Math.sqrt(variance)
  return {
    upper: mean + stdDev * std,
    middle: mean,
    lower: mean - stdDev * std,
  }
}

export function getSupportResistance(
  highs: number[],
  lows: number[],
  currentPrice: number
): { support1: number; support2: number; resistance1: number; resistance2: number } {
  // Look back across 60 trading days (~3 months) for meaningful pivots
  const recent = Math.min(60, highs.length)
  const recentHighs = highs.slice(-recent)
  const recentLows  = lows.slice(-recent)

  // Find pivot highs/lows (local extrema with at least 2 bars on each side)
  // — these are real S/R levels traders watch, not just min/max
  const pivots: { type: "high" | "low"; price: number }[] = []
  for (let i = 2; i < recent - 2; i++) {
    const isPivotHigh =
      recentHighs[i] > recentHighs[i - 1] && recentHighs[i] > recentHighs[i - 2] &&
      recentHighs[i] > recentHighs[i + 1] && recentHighs[i] > recentHighs[i + 2]
    const isPivotLow =
      recentLows[i] < recentLows[i - 1] && recentLows[i] < recentLows[i - 2] &&
      recentLows[i] < recentLows[i + 1] && recentLows[i] < recentLows[i + 2]
    if (isPivotHigh) pivots.push({ type: "high", price: recentHighs[i] })
    if (isPivotLow)  pivots.push({ type: "low",  price: recentLows[i]  })
  }

  // Cluster pivots within 2% of each other (treat as same level)
  const clusterAndPick = (candidates: number[]): number[] => {
    if (candidates.length === 0) return []
    const sorted = [...candidates].sort((a, b) => a - b)
    const clusters: number[][] = [[sorted[0]]]
    for (let i = 1; i < sorted.length; i++) {
      const last = clusters[clusters.length - 1]
      const lastAvg = last.reduce((a, b) => a + b, 0) / last.length
      if (Math.abs(sorted[i] - lastAvg) / lastAvg < 0.02) {
        last.push(sorted[i])
      } else {
        clusters.push([sorted[i]])
      }
    }
    // Return cluster averages
    return clusters.map(c => c.reduce((a, b) => a + b, 0) / c.length)
  }

  const resistanceCandidates = pivots.filter(p => p.type === "high" && p.price > currentPrice).map(p => p.price)
  const supportCandidates    = pivots.filter(p => p.type === "low"  && p.price < currentPrice).map(p => p.price)

  // R1/R2: sort ascending so R1 = NEAREST above, R2 = next above
  const resistances = clusterAndPick(resistanceCandidates).sort((a, b) => a - b)
  // S1/S2: sort descending so S1 = NEAREST below, S2 = next below
  const supports    = clusterAndPick(supportCandidates).sort((a, b) => b - a)

  return {
    resistance1: resistances[0] || currentPrice * 1.05,
    resistance2: resistances[1] || resistances[0] * 1.05 || currentPrice * 1.10,
    support1:    supports[0]    || currentPrice * 0.95,
    support2:    supports[1]    || (supports[0] || currentPrice * 0.95) * 0.95,
  }
}

export function getTechnicalAnalysis(candle: Candle, currentPrice: number): TechnicalAnalysis {
  const closes = candle.c
  const highs = candle.h
  const lows = candle.l

  const rsi = calculateRSI(closes)
  const ema20arr = calculateEMA(closes, 20)
  const ema50arr = calculateEMA(closes, 50)
  const ema100arr = calculateEMA(closes, 100)
  const ema200arr = calculateEMA(closes, 200)
  const { macd, signal: macdSignal, histogram: macdHistogram } = calculateMACD(closes)
  const bb = calculateBollingerBands(closes)
  const sr = getSupportResistance(highs, lows, currentPrice)

  const ema20 = ema20arr[ema20arr.length - 1] || currentPrice
  const ema50 = ema50arr[ema50arr.length - 1] || currentPrice
  const ema100 = ema100arr[ema100arr.length - 1] || currentPrice
  const ema200 = ema200arr[ema200arr.length - 1] || currentPrice

  const aboveEma50 = currentPrice > ema50
  const aboveEma200 = currentPrice > ema200

  let trend: "uptrend" | "downtrend" | "sideways" = "sideways"
  if (currentPrice > ema50 && currentPrice > ema200) trend = "uptrend"
  else if (currentPrice < ema50 && currentPrice < ema200) trend = "downtrend"

  let bullishSignals = 0
  if (aboveEma50) bullishSignals++
  if (aboveEma200) bullishSignals++
  if (rsi > 50 && rsi < 70) bullishSignals++
  if (macd > macdSignal) bullishSignals++
  if (currentPrice > bb.middle) bullishSignals++

  let signal: TechnicalAnalysis["signal"]
  if (bullishSignals >= 4) signal = "STRONG BUY"
  else if (bullishSignals === 3) signal = "BUY"
  else if (bullishSignals === 2) signal = "NEUTRAL"
  else if (bullishSignals === 1) signal = "SELL"
  else signal = "STRONG SELL"

  return {
    rsi,
    ema20,
    ema50,
    ema100,
    ema200,
    macd,
    macdSignal,
    macdHistogram,
    bbUpper: bb.upper,
    bbMiddle: bb.middle,
    bbLower: bb.lower,
    aboveEma50,
    aboveEma200,
    trend,
    signal,
    ...sr,
  }
}
