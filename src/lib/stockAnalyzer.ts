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
  calculateEMA, calculateRSI, calculateMACD, calculateBollingerBands,
  getSupportResistance,
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
  snapshot: MarketSnapshot

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

function buildTradeLevels(
  currentPrice: number,
  sma50: number,
  bb: { upper: number; middle: number; lower: number },
  highs: number[],
  support1?: number,
  resistance1?: number,
): TradeLevels {
  // ── Accumulation zone (where to actually buy) ─────────────────────────
  // Prefer real support level if available, else use SMA50 / BB middle as zone.
  // The zone is the price range traders should accumulate into.
  let accumLow:  number
  let accumHigh: number

  if (support1 && support1 < currentPrice && support1 > currentPrice * 0.85) {
    // Strong nearby support → accumulate between support and current
    accumLow  = support1
    accumHigh = Math.min(currentPrice * 1.01, (support1 + currentPrice) / 2 * 1.03)
  } else {
    // No clear support → accumulate between BB middle / SMA50 and current
    const baseLow = Math.max(bb.middle, sma50)
    accumLow  = Math.max(baseLow, currentPrice * 0.95)
    accumHigh = currentPrice * 1.01
  }
  // Sanity: ensure low < high
  if (accumLow >= accumHigh) {
    accumLow  = currentPrice * 0.97
    accumHigh = currentPrice * 1.01
  }

  // ── Take profit targets ────────────────────────────────────────────────
  // TP1 = nearest resistance OR +10% (whichever closer)
  // TP2 = +17% (or further resistance)
  // TP3 = +28% (moon target)
  const tp1 = resistance1 && resistance1 > currentPrice * 1.04 && resistance1 < currentPrice * 1.15
    ? resistance1
    : currentPrice * 1.10
  const tp2 = currentPrice * 1.17
  const tp3 = currentPrice * 1.28

  // ── Stop loss ──────────────────────────────────────────────────────────
  // Use the tightest of: support1 - 2%, SMA50 - 2%, or -8% from current.
  // Tighter SL = better R/R. Never wider than -8%.
  const slCandidates = [
    support1 ? support1 * 0.98 : 0,
    sma50 * 0.98,
    currentPrice * 0.92,
  ].filter(v => v > 0 && v < currentPrice)
  const sl = slCandidates.length > 0 ? Math.max(...slCandidates) : currentPrice * 0.92

  const slPct  = ((sl - currentPrice) / currentPrice) * 100
  const tp1Pct = ((tp1 - currentPrice) / currentPrice) * 100
  const tp2Pct = ((tp2 - currentPrice) / currentPrice) * 100
  const tp3Pct = ((tp3 - currentPrice) / currentPrice) * 100

  const riskReward = Math.abs(slPct) > 0 ? tp2Pct / Math.abs(slPct) : 0

  return {
    currentPrice,
    tradeAccumLow: accumLow,
    tradeAccumHigh: accumHigh,
    tp1, tp1Pct,
    tp2, tp2Pct,
    tp3, tp3Pct,
    sl,  slPct,
    riskReward,
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

const TIER_ORDER: EntryStrategy[] = ["WAIT_PULLBACK", "PARTIAL_30", "SPLIT_50", "ALL_IN"]

function downgrade(t: EntryStrategy): EntryStrategy {
  if (t === "SKIP" || t === "WAIT_PULLBACK") return t
  const idx = TIER_ORDER.indexOf(t)
  return idx > 0 ? TIER_ORDER[idx - 1] : t
}

function upgrade(t: EntryStrategy): EntryStrategy {
  if (t === "SKIP" || t === "WAIT_PULLBACK") return t
  const idx = TIER_ORDER.indexOf(t)
  return idx >= 0 && idx < TIER_ORDER.length - 1 ? TIER_ORDER[idx + 1] : t
}

const STRATEGY_META: Record<EntryStrategy, { label: string; emoji: string; color: string }> = {
  ALL_IN:         { label: "ALL IN",           emoji: "🟢", color: "text-emerald-400" },
  SPLIT_50:       { label: "SPLIT 50/50",      emoji: "🟡", color: "text-yellow-400" },
  PARTIAL_30:     { label: "PARTIAL 30%",      emoji: "🟠", color: "text-orange-400" },
  WAIT_PULLBACK:  { label: "WAIT for Pullback",emoji: "🔴", color: "text-red-400" },
  SKIP:           { label: "SKIP",             emoji: "⚫", color: "text-gray-500" },
}

function determineEntry(
  signal: SignalLevel,
  confidence: Confidence,
  currentPrice: number,
  accumLow: number,
  accumHigh: number,
  bb: { upper: number; middle: number; lower: number },
  riskReward: number,
  volumes: number[],
  trendGauges: TrendStrengthGauge[],
  thesis: ThesisCheck[],          // ← NEW: pass thesis to check specific FAILs
  changePctToday: number,          // ← NEW: today's % change (FOMO detection)
): EntryRecommendation {
  // Reference: distance from Accum Top (the visible upper bound of buy zone).
  // - Negative dist = price is in or below buy zone → great entry
  // - Positive dist = price has risen above buy zone → chasing
  const distFromAccum = ((currentPrice - accumHigh) / accumHigh) * 100
  const pctB = bb.upper > bb.lower ? (currentPrice - bb.lower) / (bb.upper - bb.lower) : 0.5
  const pullbackTarget = accumHigh
  const pullbackPct = ((accumHigh - currentPrice) / currentPrice) * 100

  // Volume ratio
  const vol5  = volumes.slice(-5).reduce((a,b)=>a+b,0) / 5
  const vol20 = volumes.slice(-20).reduce((a,b)=>a+b,0) / 20
  const volRatio = vol20 > 0 ? vol5 / vol20 : 1

  // 1W trend gauge
  const week1 = trendGauges.find(g => g.timeframe === "1W")?.score ?? 50
  const day1  = trendGauges.find(g => g.timeframe === "1D")?.score ?? 50
  const month1 = trendGauges.find(g => g.timeframe === "1M")?.score ?? 50

  const warnings: string[] = []
  const upgrades: string[] = []

  // ── Hard skips (no recommendation) ────────────────────────────────────────
  if (signal === "HOLD" || signal === "SELL" || signal === "STRONG SELL") {
    return {
      strategy: "SKIP",
      ...STRATEGY_META.SKIP,
      sizeNow: 0,
      sizeOnPullback: 0,
      distFromAccum, pctB,
      reasoning: `Signal "${signal}" — ไม่อยู่ในกลุ่มเข้าซื้อ · skip`,
      warnings: [`Signal ไม่ใช่ BUY/STRONG BUY`],
      upgrades: [],
    }
  }

  if (riskReward < 1.5) {
    return {
      strategy: "SKIP",
      ...STRATEGY_META.SKIP,
      sizeNow: 0,
      sizeOnPullback: 0,
      distFromAccum, pctB,
      reasoning: `R/R เพียง ${riskReward.toFixed(2)}× — ต่ำกว่า 1.5× ไม่คุ้มเสี่ยง`,
      warnings: [`R/R ${riskReward.toFixed(2)}× < 1.5`],
      upgrades: [],
    }
  }

  if (week1 < 30) {
    return {
      strategy: "WAIT_PULLBACK",
      ...STRATEGY_META.WAIT_PULLBACK,
      sizeNow: 0,
      sizeOnPullback: 100,
      pullbackTarget,
      pullbackPct,
      distFromAccum, pctB,
      reasoning: `1W trend gauge ${week1}/100 = Strong Sell · momentum ระยะกลางเสีย · รอ confirmation`,
      warnings: [`1W = Strong Sell (${week1})`],
      upgrades: [],
    }
  }

  // ── Base tier from distance to Accum Top ──────────────────────────────────
  //   ≤  0%  : ราคาในหรือใต้ accum zone → ALL IN
  //   0–2%   : เหนือเล็กน้อย              → SPLIT 50/50
  //   2–5%   : เหนือพอควร                 → PARTIAL 30%
  //   > 5%   : เหนือมาก (chasing)         → WAIT
  let baseTier: EntryStrategy
  if (distFromAccum <= 0) {
    baseTier = "ALL_IN"
  } else if (distFromAccum <= 2) {
    baseTier = "SPLIT_50"
  } else if (distFromAccum <= 5) {
    baseTier = "PARTIAL_30"
  } else {
    baseTier = "WAIT_PULLBACK"
  }
  let tier: EntryStrategy = baseTier

  // ── Downgrade modifiers ───────────────────────────────────────────────────

  // Critical thesis FAILs (read specific checks)
  const macdCheck     = thesis.find(t => t.id === "macd")
  const volCheck      = thesis.find(t => t.id === "vol")
  const trendCheck    = thesis.find(t => t.id === "trend")

  if (macdCheck?.status === "FAIL") {
    tier = downgrade(tier)
    warnings.push(`MACD bearish — momentum หาย แม้ราคาเด้ง`)
  }
  if (volCheck?.status === "FAIL") {
    tier = downgrade(tier)
    warnings.push(`Volume FAIL — ไม่มี buyer สนับสนุน`)
  }
  if (trendCheck?.status === "FAIL") {
    tier = downgrade(tier)
    warnings.push(`Trend Stack FAIL — โครงสร้างขาขึ้นยังไม่ confirm`)
  }

  // 1W trend gauge — Neutral (30-50) แปลว่า sideways
  if (week1 < 50 && week1 >= 30) {
    tier = downgrade(tier)
    warnings.push(`1W gauge ${week1}/100 (Neutral) — momentum ระยะกลางยังไม่ confirm`)
  }

  // FOMO detection — single-day spike >10% with above-avg volume = exhaustion risk
  if (changePctToday > 10) {
    tier = downgrade(tier)
    warnings.push(`+${changePctToday.toFixed(1)}% ใน 1 วัน — เสี่ยง exhaustion · รอ pullback ดีกว่า`)
  } else if (changePctToday > 7) {
    warnings.push(`+${changePctToday.toFixed(1)}% ใน 1 วัน — momentum spike · ระวัง mean reversion`)
  }

  // BB / Volume / Confidence / R/R modifiers
  if (pctB > 1.0) {
    tier = downgrade(tier)
    warnings.push(`ราคาทะลุ upper BB (%B=${pctB.toFixed(2)}) — overextended · เสี่ยง mean reversion`)
  }
  if (confidence === "LOW") {
    tier = downgrade(tier)
    warnings.push(`Confidence LOW`)
  }
  if (volRatio < 0.7) {
    tier = downgrade(tier)
    warnings.push(`Volume drying (${(volRatio*100).toFixed(0)}% ของ avg20)`)
  }
  if (riskReward < 2.0) {
    tier = downgrade(tier)
    warnings.push(`R/R ${riskReward.toFixed(2)}× ต่ำกว่า 2.0× (borderline)`)
  }

  // ── Upgrade modifiers (Premium setup boost) ──────────────────────────────
  const premiumSetup =
    confidence === "HIGH" &&
    signal === "STRONG BUY" &&
    week1 >= 80 &&
    month1 >= 80 &&
    day1 >= 80 &&
    volRatio >= 1.2

  if (premiumSetup) {
    tier = upgrade(tier)
    upgrades.push(`Premium setup: HIGH conf + STRONG BUY + all-TF Strong Buy + volume surge`)
  } else if (confidence === "HIGH" && signal === "STRONG BUY" && week1 >= 60) {
    upgrades.push(`Strong setup but premium upgrade ไม่ได้ใช้ — already at top tier`)
  }

  // ── Sanity guard: if tier ended at WAIT_PULLBACK but price is NOT above accum,
  // it means the downgrade came from quality issues — NOT from being too high.
  // In that case → SKIP (don't trade) is more accurate than "wait for pullback".
  if (tier === "WAIT_PULLBACK" && distFromAccum <= 0) {
    tier = "SKIP"
  }

  // ── Build the recommendation ──────────────────────────────────────────────
  const meta = STRATEGY_META[tier]
  let sizeNow = 0, sizeOnPullback = 0
  let reasoning = ""

  // Helper: signed format ("-0.5%" or "+2.1%")
  const fmtSigned = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`

  switch (tier) {
    case "ALL_IN":
      sizeNow = 100
      sizeOnPullback = 0
      reasoning = distFromAccum <= -1
        ? `ราคา $${currentPrice.toFixed(2)} อยู่ ${Math.abs(distFromAccum).toFixed(1)}% ใต้ accum top $${accumHigh.toFixed(2)} — อยู่ในโซนเข้าซื้อพอดี · เข้าได้เต็มไม้`
        : `ราคา $${currentPrice.toFixed(2)} อยู่ใน accum zone ($${accumLow.toFixed(2)}–$${accumHigh.toFixed(2)}) — เข้าได้เต็มไม้`
      break
    case "SPLIT_50":
      sizeNow = 50
      sizeOnPullback = 50
      reasoning = `ราคา $${currentPrice.toFixed(2)} เหนือ accum top $${accumHigh.toFixed(2)} เพียง +${distFromAccum.toFixed(1)}% — เข้าครึ่งไม้ตอนนี้ · เก็บอีก 50% รอ pullback ลงไปที่ $${pullbackTarget.toFixed(2)}`
      break
    case "PARTIAL_30":
      sizeNow = 30
      sizeOnPullback = 70
      reasoning = `ราคา $${currentPrice.toFixed(2)} เหนือ accum top $${accumHigh.toFixed(2)} +${distFromAccum.toFixed(1)}% — เข้าทดลอง 30% เพื่อไม่ miss the move · เก็บ 70% รอ pullback ลงไปที่ $${pullbackTarget.toFixed(2)} (${pullbackPct.toFixed(1)}%)`
      break
    case "WAIT_PULLBACK":
      sizeNow = 0
      sizeOnPullback = 100
      if (baseTier === "WAIT_PULLBACK") {
        // Genuinely too far above accum top (>5%)
        reasoning = `ราคา $${currentPrice.toFixed(2)} เหนือ accum top $${accumHigh.toFixed(2)} +${distFromAccum.toFixed(1)}% — ไกลเกินไป · ห้ามไล่ราคา · รอ pullback ลงไปที่ $${pullbackTarget.toFixed(2)} (${pullbackPct.toFixed(1)}%)`
      } else {
        // Reached WAIT due to downgrades — distance is moderate but setup quality bad
        const baseLabel = baseTier === "PARTIAL_30" ? "PARTIAL 30%"
                       : baseTier === "SPLIT_50"   ? "SPLIT 50/50"
                       : "ALL IN"
        reasoning = `ราคา $${currentPrice.toFixed(2)} เหนือ accum top +${distFromAccum.toFixed(1)}% (ในระยะ ${baseLabel} ปกติ) — แต่มี red flags ${warnings.length} ข้อ ทำให้ setup ไม่ clean · รอทั้ง pullback ลงไปที่ $${pullbackTarget.toFixed(2)} (${pullbackPct.toFixed(1)}%) AND สัญญาณ confirm (MACD bullish cross / volume surge / 1W ≥ 60) ก่อนเข้า`
      }
      break
    case "SKIP":
      sizeNow = 0
      sizeOnPullback = 0
      if (warnings.length >= 3) {
        reasoning = `ราคา $${currentPrice.toFixed(2)} อยู่ในโซน buy (${fmtSigned(distFromAccum)} from accum top) แต่มี red flags ${warnings.length} ข้อ — setup ไม่ clean · **SKIP** ดีกว่า · รอ MACD bullish cross + 1W trend confirm + volume surge ก่อนกลับมาดู`
      } else {
        reasoning = `Setup ไม่ผ่านเกณฑ์ · skip ดีกว่า`
      }
      break
  }

  // Only show pullback target if the wait is genuinely about price coming down
  // (i.e., price IS above accum top). Otherwise the "wait" is for confirmation.
  const showPullback = sizeOnPullback > 0 && distFromAccum > 0

  return {
    strategy: tier,
    label: meta.label,
    emoji: meta.emoji,
    color: meta.color,
    sizeNow,
    sizeOnPullback,
    entryPriceNow: sizeNow > 0 ? currentPrice : undefined,
    pullbackTarget: showPullback ? pullbackTarget : undefined,
    pullbackPct: showPullback ? pullbackPct : undefined,
    distFromAccum,
    pctB,
    reasoning,
    warnings,
    upgrades,
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

    // Trade levels — use real S/R from price pivots for accum zone + TP1
    const sr = getSupportResistance(highs, lows, currentPrice)
    const tradeLevels = buildTradeLevels(currentPrice, sma50, bb, highs, sr.support1, sr.resistance1)

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

    // ── Entry strategy (real-time recommendation) ─────────────────────────
    const entryRec = determineEntry(
      signal,
      confidence,
      currentPrice,
      tradeLevels.tradeAccumLow,
      tradeLevels.tradeAccumHigh,
      bb,
      tradeLevels.riskReward,
      candle.v,
      trendGauges,
      thesis,
      quote.dp ?? 0,
    )

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
      snapshot,
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
