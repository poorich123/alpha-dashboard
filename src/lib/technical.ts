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

/** Average True Range — volatility measure used for swing stop buffers. */
export function calculateATR(highs: number[], lows: number[], closes: number[], period = 14): number {
  const n = Math.min(highs.length, lows.length, closes.length)
  if (n < period + 1) return 0
  const trs: number[] = []
  for (let i = 1; i < n; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1]),
    )
    trs.push(tr)
  }
  const slice = trs.slice(-period)
  return slice.reduce((a, b) => a + b, 0) / slice.length
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

// ── Fibonacci Retracement (for long-term DCA strategy) ─────────────────────
//
// Identifies the most significant swing (high → low) in the lookback window,
// then projects standard Fibonacci retracement levels. Used as a different
// "lens" from Pivot S/R — Fib levels work better for major trend pullbacks
// where DCA / accumulation is the strategy.
//
export interface FibLevels {
  swingHigh: number
  swingLow: number
  swingHighIdx: number
  swingLowIdx: number
  direction: "up" | "down"  // "up" = uptrend retracement (buy at fib levels)
  // Standard Fibonacci retracement levels (price)
  level_0: number      // 0% = swing high (in uptrend)
  level_236: number    // 23.6% — shallow pullback
  level_382: number    // 38.2% — first DCA tranche
  level_500: number    // 50%   — second DCA tranche
  level_618: number    // 61.8% — Golden ratio, primary DCA zone
  level_786: number    // 78.6% — deep value DCA, last chance
  level_100: number    // 100% = swing low
  // Closest level to current price + distance
  nearest: { label: string; price: number; pctAway: number }
}

export function getFibLevels(
  highs: number[],
  lows: number[],
  currentPrice: number,
  lookbackDays = 252,  // ~1 year for major swing
): FibLevels | null {
  const len = Math.min(lookbackDays, highs.length)
  if (len < 30) return null  // need enough data
  const recentHighs = highs.slice(-len)
  const recentLows  = lows.slice(-len)

  // Find absolute swing extremes in window
  let swingHigh = recentHighs[0], swingHighIdx = 0
  let swingLow  = recentLows[0],  swingLowIdx  = 0
  for (let i = 1; i < len; i++) {
    if (recentHighs[i] > swingHigh) { swingHigh = recentHighs[i]; swingHighIdx = i }
    if (recentLows[i]  < swingLow)  { swingLow  = recentLows[i];  swingLowIdx  = i }
  }

  // Direction: if high comes AFTER low → uptrend (we retrace from high back down)
  //            if low comes AFTER high → downtrend (we retrace from low back up)
  const direction: "up" | "down" = swingHighIdx > swingLowIdx ? "up" : "down"

  // Calc retracement levels
  // Uptrend: 0% = high, 100% = low (price retraces DOWN to fib levels)
  // Downtrend: 0% = low, 100% = high (price retraces UP to fib levels)
  const range = swingHigh - swingLow
  const top = direction === "up" ? swingHigh : swingLow
  const bottom = direction === "up" ? swingLow : swingHigh
  const sign = direction === "up" ? -1 : 1

  const calc = (pct: number) => top + sign * range * pct
  const level_0   = top
  const level_236 = calc(0.236)
  const level_382 = calc(0.382)
  const level_500 = calc(0.500)
  const level_618 = calc(0.618)
  const level_786 = calc(0.786)
  const level_100 = bottom

  // Find nearest level
  const levels = [
    { label: "0%",    price: level_0   },
    { label: "23.6%", price: level_236 },
    { label: "38.2%", price: level_382 },
    { label: "50%",   price: level_500 },
    { label: "61.8%", price: level_618 },
    { label: "78.6%", price: level_786 },
    { label: "100%",  price: level_100 },
  ]
  const nearest = levels.reduce((best, lv) => {
    const dist = Math.abs(lv.price - currentPrice)
    const bestDist = Math.abs(best.price - currentPrice)
    return dist < bestDist ? lv : best
  })
  const pctAway = ((nearest.price - currentPrice) / currentPrice) * 100

  return {
    swingHigh, swingLow, swingHighIdx, swingLowIdx,
    direction,
    level_0, level_236, level_382, level_500, level_618, level_786, level_100,
    nearest: { ...nearest, pctAway },
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
