/**
 * TP24-style Stock Analyzer
 * ─────────────────────────
 * Comprehensive technical + fundamental scoring engine.
 *
 * Produces:
 *  • PASS/FAIL technical thesis (6 checks)
 *  • Multi-timeframe trend strength (1D, 1W, 1M, 3M, 6M, 1Y) — 0-100 scale
 *  • TP1/TP2/TP3 + SL + Trade Accumulation zone
 *  • Overall confidence score (HIGH/MEDIUM/LOW)
 *  • Signal: STRONG BUY / BUY / HOLD / SELL / STRONG SELL
 *
 * Based on: Minervini SEPA, O'Neil CANSLIM, Druckenmiller trend-following
 */

import { getQuote, getCompanyProfile } from "./finnhub"
import { getYahooCandles, deriveQuoteFromCandle } from "./yfinance"
import {
  calculateEMA, calculateRSI, calculateMACD, calculateBollingerBands, calculateATR,
  getSupportResistance, getFibLevels, type FibLevels,
} from "./technical"
import type { Candle, Quote, CompanyProfile } from "@/types"

// ─── Types ────────────────────────────────────────────────────────────────────

export type SignalLevel = "STRONG BUY" | "BUY" | "HOLD" | "SELL" | "STRONG SELL"
export type Confidence  = "HIGH" | "MEDIUM" | "LOW"
export type CheckStatus = "PASS" | "FAIL" | "NEUTRAL"
export type EntryStrategy = "ALL_IN" | "SPLIT_50" | "PARTIAL_30" | "WAIT_PULLBACK" | "SKIP"

export interface EntryRecommendation {
  strategy: EntryStrategy
  label: string                // Human-readable header
  emoji: string
  color: string                // Tailwind text color class
  sizeNow: number              // % of planned position to enter now (0-100)
  sizeOnPullback: number       // % to deploy on pullback
  entryPriceNow?: number
  pullbackTarget?: number      // Target price to wait for if not full
  pullbackPct?: number         // % away from current
  distFromAccum: number        // current vs accum mid (%)
  pctB: number                 // Bollinger %B
  reasoning: string            // Main explanation
  warnings: string[]
  upgrades: string[]
}

export interface ThesisCheck {
  id: string
  label: string
  status: CheckStatus
  value: string
  description: string
}

export interface TrendStrengthGauge {
  timeframe: "1D" | "1W" | "1M" | "3M" | "6M" | "1Y"
  score: number              // 0-100
  label: "Strong Sell" | "Sell" | "Neutral" | "Buy" | "Strong Buy"
}

export interface TradeLevels {
  currentPrice: number
  tradeAccumLow: number      // buy zone low
  tradeAccumHigh: number     // buy zone high
  tp1: number;  tp1Pct: number
  tp2: number;  tp2Pct: number
  tp3: number;  tp3Pct: number
  sl: number;   slPct: number
  riskReward: number
}

export type SwingGrade = "A" | "B" | "C" | "WAIT" | "AVOID"
export type SwingAction = "ENTER" | "WAIT_PULLBACK" | "AVOID"
export type SwingTrend = "up" | "early" | "range" | "down"

export interface SwingSetup {
  grade: SwingGrade
  action: SwingAction
  trend: SwingTrend
  support: number            // real pivot/EMA support to buy near
  resistance: number         // real pivot resistance = first target
  entryLow: number           // buy zone low (≈ support)
  entryHigh: number          // buy zone high (support + buffer)
  stop: number               // just below support (ATR buffer)
  riskPct: number            // (price − stop)/price · margin of safety
  rewardPct: number          // (resistance − price)/price
  rr: number                 // reward ÷ risk
  distToSupportPct: number   // how far price sits above support (0 = at support)
  pullbackTarget?: number    // for WAIT — price to wait for
  pullbackPct?: number
  extended: boolean
  reasons: string[]
  warnings: string[]
}

export interface MarketSnapshot {
  company: string
  ticker: string
  currentPrice: number
  previousClose: number
  change: number
  changePct: number
  marketCap: string
  exchange: string
  volume: string
  open: number
  dayLow: number
  dayHigh: number
  week52Low: number
  week52High: number
  sma50: number
  sma200: number
  peRatio?: number
  sector: string
  industry: string
  country: string
  employees: number
  ipoDate: string
  website: string
}

export interface AnalyzerResult {
  ticker: string
  companyName: string
  sector: string
  industry: string
  logo: string

  // Top-level scoring
  signal: SignalLevel
  score: number              // checks passed e.g. 5
  scoreMax: number           // effective denominator (PASS+FAIL, excludes N/A)
  scoreNA: number            // count of N/A checks
  scorePct: number           // 0-100 weighted overall score
  confidence: Confidence

  // Components
  thesis: ThesisCheck[]
  trendGauges: TrendStrengthGauge[]
  tradeLevels: TradeLevels
  entryRec: EntryRecommendation     // Real-time entry strategy
  swingSetup: SwingSetup            // Swing-at-support setup grade + risk/reward
  snapshot: MarketSnapshot

  // Levels for chart overlays — used by both DCA (Fib) and Swing (Pivot S/R) strategies
  srLevels: { support1: number; support2: number; resistance1: number; resistance2: number }
  fibLevels: FibLevels | null

  // For chart rendering
  candles: Candle
  ema15: number[]
  ema30: number[]
  ema50: number[]
  ema100: number[]
  ema200: number[]

  scannedAt: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function lastVal(arr: number[]): number {
  return arr.length ? arr[arr.length - 1] : 0
}

function fmtCompact(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + "T"
  if (n >= 1e9)  return (n / 1e9).toFixed(2) + "B"
  if (n >= 1e6)  return (n / 1e6).toFixed(2) + "M"
  if (n >= 1e3)  return (n / 1e3).toFixed(2) + "K"
  return n.toFixed(2)
}

// ─── Technical Thesis (PASS/FAIL checks) ─────────────────────────────────────

function buildThesis(
  candle: Candle,
  currentPrice: number,
  sma50: number,
  sma200: number,
  rsi: number,
  macd: { macd: number; signal: number; histogram: number },
  bb: { upper: number; middle: number; lower: number },
  peRatio?: number,
  spyChange1M?: number,
  stockChange1M?: number
): ThesisCheck[] {
  const closes  = candle.c
  const volumes = candle.v
  const recentVol  = volumes.slice(-5).reduce((a,b)=>a+b,0) / 5
  const avg20Vol   = volumes.slice(-20).reduce((a,b)=>a+b,0) / 20
  const avg50Vol   = volumes.slice(-50).reduce((a,b)=>a+b,0) / 50

  // Check 1: Trend Stack (Price > SMA50 > SMA200) — Minervini Stage 2 criterion
  const trendStackPass = currentPrice > sma50 && sma50 > sma200
  const trend: ThesisCheck = {
    id: "trend",
    label: "Trend Stack",
    status: trendStackPass ? "PASS" : "FAIL",
    value: `$${currentPrice.toFixed(2)} vs SMA50 $${sma50.toFixed(2)} / SMA200 $${sma200.toFixed(2)}`,
    description: "เช็คราคาเทียบกับเส้น SMA50 และ SMA200 เพื่อดูว่าแนวโน้มหลักยังเป็นขาขึ้นหรือไม่",
  }

  // Check 2: RSI(14) — should be 50-70 for healthy momentum (Minervini zone)
  const rsiPass = rsi >= 50 && rsi <= 70
  const rsiCheck: ThesisCheck = {
    id: "rsi",
    label: "RSI(14)",
    status: rsiPass ? "PASS" : (rsi > 70 ? "NEUTRAL" : "FAIL"),
    value: rsi.toFixed(2),
    description: "RSI ใช้ดูแรงซื้อแรงขายระยะสั้น โดยโซนที่ระบบมองว่าดีคือประมาณ 50-70",
  }

  // Check 3: MACD — line > signal
  const macdPass = macd.macd > macd.signal && macd.histogram > 0
  const macdCheck: ThesisCheck = {
    id: "macd",
    label: "MACD",
    status: macdPass ? "PASS" : "FAIL",
    value: `Line ${macd.macd.toFixed(2)} / Signal ${macd.signal.toFixed(2)}`,
    description: "MACD ใช้ดูการเร่งตัวของแนวโน้ม ถ้าเส้น MACD อยู่เหนือ signal มักดีความเป็นแรงส่งเชิงบวก",
  }

  // Check 4: Bollinger Band — price in upper half but NOT above upper band
  // Aligned with TP24 / Minervini: above upper band = overextended → FAIL
  // %B > 1 means price has > 95% probability of mean reversion soon.
  const aboveUpper = currentPrice > bb.upper
  const belowMid   = currentPrice < bb.middle
  const bbPass     = currentPrice >= bb.middle && currentPrice <= bb.upper
  const pctB       = bb.upper > bb.lower ? (currentPrice - bb.lower) / (bb.upper - bb.lower) : 0.5
  const bbCheck: ThesisCheck = {
    id: "bb",
    label: "Bollinger Band",
    status: bbPass ? "PASS" : "FAIL",  // ← above upper OR below middle both = FAIL
    value: `Price $${currentPrice.toFixed(2)} / Mid $${bb.middle.toFixed(2)} / Upper $${bb.upper.toFixed(2)} · %B=${pctB.toFixed(2)}${aboveUpper ? " (overextended)" : belowMid ? " (weak)" : ""}`,
    description: "ดูว่าราคาอยู่เหนือเส้นกลางและยังไม่ทะลุ upper band — ถ้าทะลุ upper = overextended มีความเสี่ยง mean reversion สูง · ถ้าใต้ middle = แนวโน้มอ่อน",
  }

  // Check 5: Volume Confirmation — recent volume above 20-day avg
  const volPass = recentVol >= avg20Vol
  const volCheck: ThesisCheck = {
    id: "vol",
    label: "Volume Confirmation",
    status: volPass ? "PASS" : "FAIL",
    value: `Vol ${fmtCompact(volumes[volumes.length-1] || 0)} / Avg20 ${fmtCompact(avg20Vol)} / Avg50 ${fmtCompact(avg50Vol)}`,
    description: "เช็คว่าปริมาณซื้อขายสนับสนุนทิศทางราคาจริง ไม่ใช่การขึ้นลงแบบไม่มี volume รองรับ",
  }

  // Check 6: Breakout — price above 20-day high
  const high20 = Math.max(...closes.slice(-21, -1))
  const breakoutPass = currentPrice > high20 * 0.99
  const breakout: ThesisCheck = {
    id: "breakout",
    label: "Breakout",
    status: breakoutPass ? "PASS" : "NEUTRAL",
    value: `20-day high $${high20.toFixed(2)} · Current $${currentPrice.toFixed(2)}`,
    description: "ราคาทำ new high ในรอบ 20 วันหรือไม่ — สัญญาณ momentum สำหรับ swing trade",
  }

  // Check 7: P/E (optional)
  const peCheck: ThesisCheck = {
    id: "pe",
    label: "PE Ratio",
    status: !peRatio ? "NEUTRAL" : peRatio < 0 ? "FAIL" : peRatio < 50 ? "PASS" : "NEUTRAL",
    value: peRatio ? peRatio.toFixed(2) : "N/A",
    description: "PE ที่ไม่สูงเกินสะท้อนว่าราคาไม่ได้สะท้อนความคาดหวังเกินจริงมากเกินไป",
  }

  // Check 8: Relative Strength (vs SPY)
  let rsStatus: CheckStatus = "NEUTRAL"
  let rsValue = "N/A"
  if (spyChange1M !== undefined && stockChange1M !== undefined) {
    const rs = stockChange1M - spyChange1M
    rsStatus = rs > 0 ? "PASS" : "FAIL"
    rsValue = `${stockChange1M >= 0 ? "+" : ""}${stockChange1M.toFixed(1)}% vs SPY ${spyChange1M >= 0 ? "+" : ""}${spyChange1M.toFixed(1)}% (RS ${rs >= 0 ? "+" : ""}${rs.toFixed(1)}%)`
  }
  const rsCheck: ThesisCheck = {
    id: "rs",
    label: "Relative Strength",
    status: rsStatus,
    value: rsValue,
    description: "เปรียบเทียบผลตอบแทน 1 เดือนกับ SPY — ตัวที่ outperform ตลาดมักเป็นผู้นำในรอบนั้นๆ",
  }

  return [trend, rsiCheck, macdCheck, bbCheck, volCheck, breakout, peCheck, rsCheck]
}

// ─── Multi-timeframe Trend Strength ──────────────────────────────────────────

function calcTimeframeScore(closes: number[], volumes: number[], bars: number): number {
  if (closes.length < bars + 5) return 50

  const slice  = closes.slice(-bars)
  const start  = slice[0]
  const end    = slice[slice.length - 1]
  const change = (end - start) / start * 100  // % change in this window

  // Linear trend strength via correlation with time
  const n = slice.length
  const xMean = (n - 1) / 2
  const yMean = slice.reduce((a, b) => a + b, 0) / n
  let num = 0, denX = 0, denY = 0
  for (let i = 0; i < n; i++) {
    num  += (i - xMean) * (slice[i] - yMean)
    denX += (i - xMean) ** 2
    denY += (slice[i] - yMean) ** 2
  }
  const corr = denX && denY ? num / Math.sqrt(denX * denY) : 0  // -1 to +1

  // Volume confirmation
  const volSlice = volumes.slice(-bars)
  const volRecent = volSlice.slice(-Math.floor(bars/4)).reduce((a,b)=>a+b,0) / Math.floor(bars/4)
  const volAvg    = volSlice.reduce((a,b)=>a+b,0) / bars
  const volBonus  = volAvg && volRecent > volAvg ? 1 : 0  // +1 if volume increasing

  // Compose score 0-100
  // Base 50 + correlation (-30 to +30) + return contribution (-15 to +15) + volume bonus
  let score = 50
  score += corr * 30
  score += Math.max(-15, Math.min(15, change * 0.8))
  if (volBonus && change > 0) score += 5
  if (!volBonus && change < 0) score += -3

  return Math.max(0, Math.min(100, Math.round(score)))
}

function labelFromScore(s: number): TrendStrengthGauge["label"] {
  if (s >= 80) return "Strong Buy"
  if (s >= 60) return "Buy"
  if (s >= 40) return "Neutral"
  if (s >= 20) return "Sell"
  return "Strong Sell"
}

function buildGauges(candle: Candle): TrendStrengthGauge[] {
  // Daily candles → use bars proportional to timeframe
  // 1D=2, 1W=5, 1M=21, 3M=63, 6M=126, 1Y=252
  const tf: { name: TrendStrengthGauge["timeframe"]; bars: number }[] = [
    { name: "1D", bars: 2  },
    { name: "1W", bars: 5  },
    { name: "1M", bars: 21 },
    { name: "3M", bars: 63 },
    { name: "6M", bars: 126},
    { name: "1Y", bars: 252},
  ]
  return tf.map(({ name, bars }) => {
    const score = calcTimeframeScore(candle.c, candle.v, Math.min(bars, candle.c.length - 1))
    return { timeframe: name, score, label: labelFromScore(score) }
  })
}

// ─── Trade Levels ─────────────────────────────────────────────────────────────

// ─── Swing Setup Engine ──────────────────────────────────────────────────────
//
// Professional swing lens: only buy WITH the trend, AT a real support, with a
// stop just below it (small defined risk = margin of safety) and asymmetric R/R
// to a real resistance. If price is extended above support → WAIT for a pullback
// rather than chasing (kills the "ALL IN at %B 0.99" behaviour).

function computeSwingSetup(
  currentPrice: number,
  sr: { support1: number; support2: number; resistance1: number; resistance2: number },
  fib: FibLevels | null,
  ema20: number, ema50: number, ema200: number,
  rsi: number, pctB: number, atr: number,
): SwingSetup {
  // ── Trend ──
  let trend: SwingTrend = "range"
  if (currentPrice > ema50 && ema50 > ema200) trend = "up"
  else if (currentPrice > ema50) trend = "early"
  else if (currentPrice < ema50 && currentPrice < ema200) trend = "down"

  // ── Nearest real support below price (pivot / EMA / fib) ──
  const supportCands = [
    sr.support1, ema20, ema50,
    fib?.level_382, fib?.level_500, fib?.level_618,
  ].filter((v): v is number => typeof v === "number" && v > 0 && v <= currentPrice * 1.005)
  const support = supportCands.length ? Math.max(...supportCands) : currentPrice * 0.92
  const hasSupport = supportCands.length > 0

  // ── Nearest real resistance above price ──
  const resCands = [sr.resistance1, sr.resistance2, fib?.swingHigh]
    .filter((v): v is number => typeof v === "number" && v > currentPrice * 1.005)
  const resistance = resCands.length ? Math.min(...resCands) : currentPrice * 1.12
  const hasResistance = resCands.length > 0

  // ── Risk / reward (margin of safety) ──
  const atrBuf = Math.max(atr, support * 0.02)
  const stop = support - atrBuf
  const riskPct = ((currentPrice - stop) / currentPrice) * 100
  const rewardPct = ((resistance - currentPrice) / currentPrice) * 100
  const rr = riskPct > 0 ? rewardPct / riskPct : 0
  const distToSupportPct = ((currentPrice - support) / currentPrice) * 100

  const entryLow = support * 0.995
  const entryHigh = support * 1.03

  const extended = rsi > 72 || pctB > 1 || (ema20 > 0 && currentPrice / ema20 - 1 > 0.08)

  const reasons: string[] = []
  const warnings: string[] = []

  let grade: SwingGrade
  let action: SwingAction
  let pullbackTarget: number | undefined
  let pullbackPct: number | undefined

  const eligible = trend === "up" || trend === "early" || trend === "range"

  if (trend === "down") {
    grade = "AVOID"; action = "AVOID"
    warnings.push("แนวโน้มเป็นขาลง (ใต้ EMA50 & EMA200) — ไม่เข้า long")
  } else if (!hasSupport || !hasResistance) {
    grade = "AVOID"; action = "AVOID"
    warnings.push("ไม่มีแนวรับ/แนวต้านจริงที่ชัดเจน — ไม่มี setup")
  } else if (rr < 1.5) {
    grade = "WAIT"; action = "WAIT_PULLBACK"; pullbackTarget = entryHigh
    warnings.push(`R/R ${rr.toFixed(1)}× ที่ราคานี้ต่ำ — รอราคาย่อมาที่แนวรับ $${entryHigh.toFixed(2)}`)
  } else if (extended) {
    grade = "WAIT"; action = "WAIT_PULLBACK"; pullbackTarget = entryHigh
    if (rsi > 72) warnings.push(`RSI ${rsi.toFixed(0)} — overbought`)
    if (pctB > 1) warnings.push(`ราคาทะลุ upper BB (%B ${pctB.toFixed(2)})`)
    if (ema20 > 0 && currentPrice / ema20 - 1 > 0.08) warnings.push(`ราคาสูงกว่า EMA20 ${((currentPrice / ema20 - 1) * 100).toFixed(0)}% — ยืดเกิน`)
    warnings.push(`อย่าไล่ราคา · รอ pullback ลงมาที่แนวรับจริง $${entryHigh.toFixed(2)}`)
  } else if (distToSupportPct > 8) {
    grade = "WAIT"; action = "WAIT_PULLBACK"; pullbackTarget = entryHigh
    warnings.push(`ราคาห่างแนวรับจริง ${distToSupportPct.toFixed(0)}% — risk กว้างไป รอ pullback ลงมาที่ $${entryHigh.toFixed(2)}`)
  } else if (distToSupportPct <= 3 && rr >= 2.5 && riskPct <= 8) {
    grade = "A"; action = "ENTER"
    reasons.push(`ราคาอยู่ที่แนวรับจริง (ห่าง ${distToSupportPct.toFixed(1)}%) · risk เพียง ${riskPct.toFixed(1)}% ถึง stop · R/R ${rr.toFixed(1)}×`)
  } else if (distToSupportPct <= 5 && rr >= 2 && rsi < 70) {
    grade = "B"; action = "ENTER"
    reasons.push(`ใกล้แนวรับจริง (ห่าง ${distToSupportPct.toFixed(1)}%) · R/R ${rr.toFixed(1)}× · risk ${riskPct.toFixed(1)}%`)
  } else {
    grade = "C"; action = "ENTER"
    reasons.push(`อยู่กลางทาง (ห่างแนวรับ ${distToSupportPct.toFixed(1)}%) · R/R ${rr.toFixed(1)}× — เข้าได้บางส่วน หรือรอย่อให้ใกล้แนวรับ`)
  }

  if (action === "WAIT_PULLBACK" && pullbackTarget) {
    pullbackPct = ((pullbackTarget - currentPrice) / currentPrice) * 100
  }
  if (action === "ENTER") {
    reasons.push(`เป้าแรกที่แนวต้านจริง $${resistance.toFixed(2)} (+${rewardPct.toFixed(1)}%) · stop $${stop.toFixed(2)} (−${riskPct.toFixed(1)}%)`)
    if (!eligible) warnings.push("แนวโน้มไม่ชัด — ระวัง")
  }

  return {
    grade, action, trend,
    support, resistance, entryLow, entryHigh, stop,
    riskPct, rewardPct, rr, distToSupportPct,
    pullbackTarget, pullbackPct, extended,
    reasons, warnings,
  }
}

// ─── Trade Levels — anchored to the swing setup (real S/R) ────────────────────

function buildTradeLevels(currentPrice: number, swing: SwingSetup, sr: { resistance2: number }): TradeLevels {
  // Buy zone = swing entry zone (around real support)
  const accumLow = swing.entryLow
  const accumHigh = swing.entryHigh

  // TP1 = real resistance · TP2 = next real resistance or measured move · TP3 = extension
  const tp1 = swing.resistance
  const tp2 = sr.resistance2 > tp1 * 1.02 ? sr.resistance2 : tp1 + (tp1 - swing.support)  // measured move
  const tp3 = Math.max(tp2 + (tp2 - tp1), currentPrice * 1.28)
  const sl = swing.stop

  const slPct  = ((sl - currentPrice) / currentPrice) * 100
  const tp1Pct = ((tp1 - currentPrice) / currentPrice) * 100
  const tp2Pct = ((tp2 - currentPrice) / currentPrice) * 100
  const tp3Pct = ((tp3 - currentPrice) / currentPrice) * 100

  return {
    currentPrice,
    tradeAccumLow: accumLow,
    tradeAccumHigh: accumHigh,
    tp1, tp1Pct,
    tp2, tp2Pct,
    tp3, tp3Pct,
    sl,  slPct,
    riskReward: swing.rr,   // reward to real resistance ÷ risk to stop
  }
}

// ─── SMA (simple, since we use it for the snapshot) ──────────────────────────

function sma(arr: number[], period: number): number {
  if (arr.length < period) return arr[arr.length - 1] || 0
  return arr.slice(-period).reduce((a, b) => a + b, 0) / period
}

// ─── Entry Strategy Engine ──────────────────────────────────────────────────
//
// Decides ALL_IN vs SPLIT_50 vs PARTIAL_30 vs WAIT_PULLBACK in real-time
// based on:
//   1. Distance from Accumulation Zone (primary driver)
//   2. Bollinger %B (overextension penalty)
//   3. Confidence + Signal strength (upgrade/downgrade)
//   4. Volume + 1W trend (red flags)
//   5. R/R ratio (hard filter)
//
// Returns null for HOLD/SELL/STRONG SELL (signal not actionable).

const STRATEGY_META: Record<EntryStrategy, { label: string; emoji: string; color: string }> = {
  ALL_IN:         { label: "ALL IN",           emoji: "🟢", color: "text-emerald-400" },
  SPLIT_50:       { label: "SPLIT 50/50",      emoji: "🟡", color: "text-yellow-400" },
  PARTIAL_30:     { label: "PARTIAL 30%",      emoji: "🟠", color: "text-orange-400" },
  WAIT_PULLBACK:  { label: "WAIT for Pullback",emoji: "🔴", color: "text-red-400" },
  SKIP:           { label: "SKIP",             emoji: "⚫", color: "text-gray-500" },
}

function determineEntry(
  signal: SignalLevel,
  swing: SwingSetup,
  currentPrice: number,
  pctB: number,
): EntryRecommendation {
  const distFromAccum = ((currentPrice - swing.entryHigh) / swing.entryHigh) * 100

  // Never long into a strong-sell technical reading, or a no-setup structure.
  if (signal === "STRONG SELL" || swing.action === "AVOID") {
    return {
      strategy: "SKIP", ...STRATEGY_META.SKIP,
      sizeNow: 0, sizeOnPullback: 0, distFromAccum, pctB,
      reasoning: swing.warnings[0] || `Signal "${signal}" — ไม่มี setup เข้าซื้อ · skip`,
      warnings: swing.warnings.length ? swing.warnings : ["ไม่มี swing setup"],
      upgrades: [],
    }
  }

  // Extended / poor location → wait for a pullback to REAL support (no chasing).
  if (swing.action === "WAIT_PULLBACK") {
    const target = swing.pullbackTarget ?? swing.entryHigh
    const pct = swing.pullbackPct ?? ((target - currentPrice) / currentPrice) * 100
    return {
      strategy: "WAIT_PULLBACK", ...STRATEGY_META.WAIT_PULLBACK,
      sizeNow: 0, sizeOnPullback: 100,
      pullbackTarget: target, pullbackPct: pct,
      distFromAccum, pctB,
      reasoning: `ราคา $${currentPrice.toFixed(2)} ยังไม่ใช่จุดเข้าที่ปลอดภัย — รอ pullback ลงมาที่แนวรับจริง $${target.toFixed(2)} (${pct.toFixed(1)}%) · margin of safety เกิดที่แนวรับ ไม่ใช่ที่ยอด`,
      warnings: swing.warnings,
      upgrades: [],
    }
  }

  // ENTER — size by setup grade (A prime → full · B → 60% · C → 30%).
  let strategy: EntryStrategy
  let sizeNow: number
  if (swing.grade === "A") { strategy = "ALL_IN"; sizeNow = 100 }
  else if (swing.grade === "B") { strategy = "SPLIT_50"; sizeNow = 60 }
  else { strategy = "PARTIAL_30"; sizeNow = 30 }
  const sizeOnPullback = 100 - sizeNow
  const meta = STRATEGY_META[strategy]

  const reasoning = swing.reasons.join(" · ") +
    (sizeOnPullback > 0 ? ` · เก็บอีก ${sizeOnPullback}% ถ้าย่อมาที่แนวรับ $${swing.entryHigh.toFixed(2)}` : "")

  return {
    strategy, label: meta.label, emoji: meta.emoji, color: meta.color,
    sizeNow, sizeOnPullback,
    entryPriceNow: currentPrice,
    pullbackTarget: sizeOnPullback > 0 ? swing.entryHigh : undefined,
    pullbackPct: sizeOnPullback > 0 ? ((swing.entryHigh - currentPrice) / currentPrice) * 100 : undefined,
    distFromAccum, pctB,
    reasoning,
    warnings: swing.warnings,
    upgrades: swing.grade === "A" ? ["Grade A — prime swing setup ที่แนวรับจริง risk เล็ก R/R สูง"] : [],
  }
}

// ─── Main analyzer ────────────────────────────────────────────────────────────

export async function analyzeStock(ticker: string): Promise<AnalyzerResult | null> {
  ticker = ticker.toUpperCase().trim()
  if (!ticker) return null

  try {
    // ── Fetch candles from Yahoo Finance (free, no API key) ──────────────
    // Use 2y range so we have enough data for SMA200 calculations.
    let candle: Candle
    try {
      candle = await getYahooCandles(ticker, "2y", "1d")
    } catch (err) {
      console.error("[analyzer] Yahoo candle fetch failed:", err)
      return null
    }
    if (!candle || candle.c.length < 30) {
      console.warn(`[analyzer] Insufficient candle data for ${ticker} (${candle?.c?.length || 0} bars)`)
      return null
    }

    // ── Fetch SPY candles for relative-strength comparison (best-effort) ──
    let spyCandle: Candle | null = null
    try {
      spyCandle = await getYahooCandles("SPY", "1mo", "1d")
    } catch {
      // ignore — RS check will show N/A
    }

    // ── Fetch Finnhub quote + profile (best-effort) ──────────────────────
    // Quote: use Finnhub if available; fall back to derived from Yahoo candle.
    let quote: Quote | null = null
    try {
      quote = await getQuote(ticker)
      if (!quote || !quote.c) quote = null
    } catch {
      quote = null
    }
    if (!quote) {
      const derived = deriveQuoteFromCandle(candle)
      if (!derived) return null
      quote = derived as Quote
    }

    let profile: CompanyProfile | null = null
    try {
      profile = await getCompanyProfile(ticker)
    } catch {
      // ignore — show ticker-only info
    }

    const currentPrice = quote.c || candle.c[candle.c.length - 1]
    if (!currentPrice || currentPrice <= 0) return null
    const closes  = candle.c
    const highs   = candle.h
    const lows    = candle.l

    // Indicators
    const ema15arr  = calculateEMA(closes, 15)
    const ema30arr  = calculateEMA(closes, 30)
    const ema50arr  = calculateEMA(closes, 50)
    const ema100arr = calculateEMA(closes, 100)
    const ema200arr = calculateEMA(closes, 200)
    const sma50  = sma(closes, 50)
    const sma200 = sma(closes, 200)
    const rsi    = calculateRSI(closes)
    const macd   = calculateMACD(closes)
    const bb     = calculateBollingerBands(closes)

    // 1-month change for stock & SPY
    const stockChange1M = closes.length >= 21
      ? ((currentPrice - closes[closes.length - 22]) / closes[closes.length - 22] * 100)
      : undefined
    const spyChange1M = spyCandle && spyCandle.c.length >= 21
      ? ((spyCandle.c[spyCandle.c.length - 1] - spyCandle.c[0]) / spyCandle.c[0] * 100)
      : undefined

    // Thesis
    const thesis = buildThesis(
      candle, currentPrice, sma50, sma200, rsi, macd, bb,
      profile?.marketCapitalization ? undefined : undefined,
      spyChange1M, stockChange1M
    )

    // ── Effective scoring ──
    // N/A (NEUTRAL) means "no data / not applicable" — we should NOT penalize it.
    // Denominator = only checks with a definitive answer (PASS + FAIL).
    // This matches TP24-style scoring where 5/6 with 2 N/A is shown as 5/6 (not 5/8).
    const passing  = thesis.filter(t => t.status === "PASS").length
    const failing  = thesis.filter(t => t.status === "FAIL").length
    const na       = thesis.filter(t => t.status === "NEUTRAL").length
    const scorable = passing + failing  // effective denominator
    const total    = scorable > 0 ? scorable : thesis.length

    // Trend gauges
    const trendGauges = buildGauges(candle)
    const avgGauge = trendGauges.reduce((a, g) => a + g.score, 0) / trendGauges.length

    // ── Swing setup — real pivot S/R + ATR stop → grade + entry zone ──────
    const sr = getSupportResistance(highs, lows, currentPrice)
    const fibLevels = getFibLevels(highs, lows, currentPrice, 252)  // 1-year swing
    const atr = calculateATR(highs, lows, closes)
    const ema20 = lastVal(calculateEMA(closes, 20))
    const ema50v = lastVal(ema50arr)
    const ema200v = lastVal(ema200arr)
    const pctB = bb.upper > bb.lower ? (currentPrice - bb.lower) / (bb.upper - bb.lower) : 0.5
    const swingSetup = computeSwingSetup(currentPrice, sr, fibLevels, ema20, ema50v, ema200v, rsi, pctB, atr)
    const tradeLevels = buildTradeLevels(currentPrice, swingSetup, sr)

    // ── Signal logic — use ratio (passing/scorable) not raw count ──
    // This makes "5/6 with 2 N/A" equivalent to "5/6" without N/A penalty.
    const passRatio = scorable > 0 ? passing / scorable : 0  // 0.0 – 1.0
    let signal: SignalLevel
    if (passRatio >= 0.85 && avgGauge >= 70)       signal = "STRONG BUY"   // 85%+
    else if (passRatio >= 0.70 && avgGauge >= 55)  signal = "BUY"          // 70%+
    else if (passRatio >= 0.40 && avgGauge >= 40)  signal = "HOLD"
    else if (passRatio >= 0.25)                    signal = "SELL"
    else                                            signal = "STRONG SELL"

    // Overall confidence score (0-100) — uses effective ratio
    const scorePct = Math.round(passRatio * 60 + (avgGauge / 100) * 40)
    let confidence: Confidence = "LOW"
    if (scorePct >= 80) confidence = "HIGH"
    else if (scorePct >= 60) confidence = "MEDIUM"

    // ── Entry strategy — driven by the swing setup (enter at support / wait) ──
    const entryRec = determineEntry(signal, swingSetup, currentPrice, pctB)

    // Market snapshot
    const snapshot: MarketSnapshot = {
      company: profile?.name || ticker,
      ticker,
      currentPrice,
      previousClose: quote.pc,
      change: quote.d,
      changePct: quote.dp,
      marketCap: profile?.marketCapitalization ? fmtCompact(profile.marketCapitalization * 1e6) : "N/A",
      exchange: profile?.exchange || "—",
      volume: fmtCompact(candle.v[candle.v.length - 1] || 0),
      open: quote.o,
      dayLow: quote.l,
      dayHigh: quote.h,
      week52Low:  Math.min(...lows.slice(-252)),
      week52High: Math.max(...highs.slice(-252)),
      sma50,
      sma200,
      sector: profile?.finnhubIndustry || "—",
      industry: profile?.finnhubIndustry || "—",
      country: profile?.country || "—",
      employees: 0,
      ipoDate: "",
      website: profile?.weburl || "",
    }

    return {
      ticker,
      companyName: profile?.name || ticker,
      sector: profile?.finnhubIndustry || "—",
      industry: profile?.finnhubIndustry || "—",
      logo: profile?.logo || "",
      signal,
      score: passing,
      scoreMax: total,
      scoreNA: na,
      scorePct,
      confidence,
      thesis,
      trendGauges,
      tradeLevels,
      entryRec,
      swingSetup,
      snapshot,
      srLevels: sr,
      fibLevels,
      candles: candle,
      ema15: ema15arr,
      ema30: ema30arr,
      ema50: ema50arr,
      ema100: ema100arr,
      ema200: ema200arr,
      scannedAt: Date.now(),
    }
  } catch (err) {
    console.error("[analyzeStock]", err)
    return null
  }
}
