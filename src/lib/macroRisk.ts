/**
 * Macro Risk Monitor
 * ──────────────────
 * Real-time tracking of the macro factors that whales/hedge funds watch:
 *
 *  • Oil & energy        → CL=F (WTI), BZ=F (Brent), XLE (energy stocks)
 *  • Geopolitical risk   → GLD/gold, oil spike + VIX
 *  • Inflation           → TIP (TIPS), 10Y real yield
 *  • Rates / Fed         → ^TNX (10Y), ^FVX (5Y), ^IRX (3M), yield curve
 *  • Dollar strength     → DX-Y.NYB (DXY) — strong $ = risk-off
 *  • Crypto sentiment    → BTC-USD risk appetite proxy
 *  • Bond volatility     → ^MOVE (the "VIX of bonds")
 *  • Stock fear          → ^VIX (already in marketRegime)
 */

import { getYahooCandles } from "./yfinance"

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "EXTREME"

export interface RiskFactor {
  id: string
  label: string
  emoji: string
  level: RiskLevel
  score: number          // 0-10 (10 = max risk)
  metrics: { label: string; value: string; tone: "good" | "neutral" | "warn" | "bad" }[]
  signal: string         // one-line takeaway
  whatToDo: string       // actionable guidance
}

export interface MacroSnapshot {
  overallRisk: RiskLevel
  riskScore: number      // weighted avg 0-100
  factors: RiskFactor[]
  topConcern: string     // headline risk
  scannedAt: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pctChange(arr: number[], lookback: number): number {
  if (arr.length < lookback + 1) return 0
  const recent = arr[arr.length - 1]
  const prior  = arr[arr.length - 1 - lookback]
  return prior > 0 ? ((recent - prior) / prior) * 100 : 0
}

function lastVal(arr: number[]): number { return arr[arr.length - 1] || 0 }

function levelFromScore(s: number): RiskLevel {
  if (s >= 8) return "EXTREME"
  if (s >= 6) return "HIGH"
  if (s >= 3) return "MEDIUM"
  return "LOW"
}

function fmtPct(n: number, prefix = true): string {
  return `${prefix && n >= 0 ? "+" : ""}${n.toFixed(2)}%`
}

// ─── Risk factor builders ────────────────────────────────────────────────────

async function oilEnergyFactor(): Promise<RiskFactor> {
  try {
    const [wti, brent, xle] = await Promise.all([
      getYahooCandles("CL=F", "3mo", "1d").catch(() => null),
      getYahooCandles("BZ=F", "3mo", "1d").catch(() => null),
      getYahooCandles("XLE",  "3mo", "1d").catch(() => null),
    ])

    const wtiPrice  = wti ? lastVal(wti.c) : 0
    const wti5d     = wti ? pctChange(wti.c, 5) : 0
    const wti20d    = wti ? pctChange(wti.c, 20) : 0
    const brentPrice= brent ? lastVal(brent.c) : 0
    const xle5d     = xle ? pctChange(xle.c, 5) : 0

    // Risk scoring: oil >5% in 5d = HIGH (geopolitical), >10% = EXTREME
    let score = 1
    if (wti5d > 3)  score = 4
    if (wti5d > 5)  score = 6  // major spike — Iran/OPEC/war signal
    if (wti5d > 8)  score = 8
    if (wti5d > 12) score = 10
    if (wti5d < -5) score = Math.max(score, 4) // crash also risky for energy stocks

    const signal =
      wti5d > 5 ? "Oil spiking — geopolitical/supply shock risk active"
      : wti5d < -5 ? "Oil dropping — demand concerns / recession signal"
      : "Oil price stable — no immediate energy risk"

    const whatToDo =
      wti5d > 5  ? "Watch energy stocks (XLE) for outperformance · Airlines/cruise lines for pressure · Hedge with XLE long"
      : wti5d < -5 ? "Avoid energy long positions · Watch for demand-side recession signs · Possible Fed dovish trigger"
      : "Normal positioning · No special energy hedges needed"

    return {
      id: "oil",
      label: "Oil & Energy",
      emoji: "🛢️",
      level: levelFromScore(score),
      score,
      metrics: [
        { label: "WTI Crude",  value: `$${wtiPrice.toFixed(2)}`, tone: "neutral" },
        { label: "Brent",      value: `$${brentPrice.toFixed(2)}`, tone: "neutral" },
        { label: "WTI 5d",     value: fmtPct(wti5d),  tone: wti5d > 3 ? "warn" : wti5d < -3 ? "warn" : "neutral" },
        { label: "WTI 20d",    value: fmtPct(wti20d), tone: wti20d > 8 ? "bad" : "neutral" },
        { label: "XLE 5d",     value: fmtPct(xle5d),  tone: xle5d > 3 ? "good" : "neutral" },
      ],
      signal,
      whatToDo,
    }
  } catch {
    return { id: "oil", label: "Oil & Energy", emoji: "🛢️", level: "LOW", score: 0, metrics: [], signal: "Data unavailable", whatToDo: "—" }
  }
}

async function inflationFactor(): Promise<RiskFactor> {
  try {
    const [tip, tnx] = await Promise.all([
      getYahooCandles("TIP",   "3mo", "1d").catch(() => null),
      getYahooCandles("^TNX",  "3mo", "1d").catch(() => null),
    ])

    const tnxLast = tnx ? lastVal(tnx.c) : 0   // 10Y yield in %
    const tnx5d   = tnx ? pctChange(tnx.c, 5) : 0
    const tnx20d  = tnx ? pctChange(tnx.c, 20) : 0
    const tip20d  = tip ? pctChange(tip.c, 20) : 0

    // High 10Y yield = inflation/Fed hawkish risk
    // Falling TIP = inflation expectations rising
    let score = 1
    if (tnxLast > 4.5) score = 4
    if (tnxLast > 5.0) score = 7
    if (tnx5d > 8)     score = Math.max(score, 6)
    if (tip20d < -3)   score = Math.max(score, 5)

    const signal =
      tnxLast > 5.0 ? "10Y at danger zone — equity multiple compression risk"
      : tnx5d > 8    ? "Yields surging — Fed re-pricing hawkish"
      : tnxLast > 4.5 ? "Yields elevated — growth/tech under pressure"
      : "Yields contained — equity-supportive"

    const whatToDo =
      tnxLast > 4.8 || tnx5d > 8
        ? "Trim high-P/E growth stocks · Avoid long-duration bonds · Consider energy/value rotation"
        : tnxLast > 4.5
        ? "Watch tech/growth carefully · Stay nimble on duration"
        : "Growth & duration are OK · Normal positioning"

    return {
      id: "inflation",
      label: "Inflation & Fed",
      emoji: "🔥",
      level: levelFromScore(score),
      score,
      metrics: [
        { label: "10Y Yield",  value: `${tnxLast.toFixed(2)}%`, tone: tnxLast > 4.8 ? "bad" : tnxLast > 4.3 ? "warn" : "good" },
        { label: "10Y 5d",     value: fmtPct(tnx5d),  tone: tnx5d > 5 ? "bad" : "neutral" },
        { label: "10Y 20d",    value: fmtPct(tnx20d), tone: tnx20d > 8 ? "bad" : "neutral" },
        { label: "TIPS 20d",   value: fmtPct(tip20d), tone: tip20d < -2 ? "warn" : "neutral" },
      ],
      signal,
      whatToDo,
    }
  } catch {
    return { id: "inflation", label: "Inflation & Fed", emoji: "🔥", level: "LOW", score: 0, metrics: [], signal: "Data unavailable", whatToDo: "—" }
  }
}

async function yieldCurveFactor(): Promise<RiskFactor> {
  try {
    const [tnx, fvx] = await Promise.all([
      getYahooCandles("^TNX", "3mo", "1d").catch(() => null),
      getYahooCandles("^FVX", "3mo", "1d").catch(() => null),
    ])

    const tnxLast = tnx ? lastVal(tnx.c) : 0
    const fvxLast = fvx ? lastVal(fvx.c) : 0
    const spread = tnxLast - fvxLast  // 10Y - 5Y proxy

    // Inverted (negative) = recession signal
    let score = 1
    if (spread < 0.5)  score = 3
    if (spread < 0)    score = 6
    if (spread < -0.5) score = 8
    if (spread < -1)   score = 10

    const signal =
      spread < -0.5 ? "Yield curve deeply inverted — recession signal active"
      : spread < 0    ? "Curve inverted — historical recession indicator"
      : spread < 0.5  ? "Curve flat — late-cycle warning"
      : "Curve normal — economy in expansion mode"

    const whatToDo =
      spread < 0
        ? "Reduce cyclicals (banks, industrials) · Add quality + defensive · Build cash for opportunities"
        : spread < 0.5
        ? "Tilt toward quality · Trim high-beta cyclicals"
        : "Normal cyclical exposure OK"

    return {
      id: "yieldcurve",
      label: "Yield Curve / Recession",
      emoji: "📉",
      level: levelFromScore(score),
      score,
      metrics: [
        { label: "10Y Yield", value: `${tnxLast.toFixed(2)}%`, tone: "neutral" },
        { label: "5Y Yield",  value: `${fvxLast.toFixed(2)}%`, tone: "neutral" },
        { label: "10Y-5Y Spread", value: `${spread >= 0 ? "+" : ""}${spread.toFixed(2)}%`, tone: spread < 0 ? "bad" : spread < 0.5 ? "warn" : "good" },
      ],
      signal,
      whatToDo,
    }
  } catch {
    return { id: "yieldcurve", label: "Yield Curve", emoji: "📉", level: "LOW", score: 0, metrics: [], signal: "Data unavailable", whatToDo: "—" }
  }
}

async function geopoliticalFactor(): Promise<RiskFactor> {
  try {
    const [gold, oil, vix] = await Promise.all([
      getYahooCandles("GC=F", "3mo", "1d").catch(() => null),
      getYahooCandles("CL=F", "3mo", "1d").catch(() => null),
      getYahooCandles("^VIX", "3mo", "1d").catch(() => null),
    ])

    const goldPrice = gold ? lastVal(gold.c) : 0
    const gold5d    = gold ? pctChange(gold.c, 5) : 0
    const gold20d   = gold ? pctChange(gold.c, 20) : 0
    const oil5d     = oil  ? pctChange(oil.c, 5)  : 0
    const vixLast   = vix  ? lastVal(vix.c) : 0

    // Geopolitical: gold rising + oil rising + VIX rising = war/crisis signal
    let score = 1
    if (gold5d > 2)               score += 2
    if (gold5d > 4)               score += 2
    if (oil5d > 5)                score += 2
    if (vixLast > 22)             score += 2
    if (gold5d > 3 && oil5d > 3)  score += 2  // combo
    score = Math.min(10, score)

    const combo = gold5d > 2 && oil5d > 3
    const signal =
      combo                  ? "🚨 Gold + Oil both spiking — Iran/Middle East/war risk active"
      : gold5d > 4           ? "Gold spike — safe-haven flight underway"
      : oil5d > 5            ? "Oil spike — supply/geopolitical shock"
      : "No active geopolitical stress signal"

    const whatToDo =
      combo
        ? "🛡️ Add defensive: gold (GLD), VIX calls, reduce risk-on (high beta, EM, crypto). Cash >25%."
        : gold5d > 4
        ? "Add small gold/defensive hedge · Tighten stops on cyclicals"
        : "Normal positioning · monitor news flow"

    return {
      id: "geopolitical",
      label: "Geopolitical Risk",
      emoji: "🌍",
      level: levelFromScore(score),
      score,
      metrics: [
        { label: "Gold",      value: `$${goldPrice.toFixed(2)}`, tone: "neutral" },
        { label: "Gold 5d",   value: fmtPct(gold5d),  tone: gold5d > 3 ? "warn" : "neutral" },
        { label: "Gold 20d",  value: fmtPct(gold20d), tone: gold20d > 5 ? "warn" : "neutral" },
        { label: "Oil 5d",    value: fmtPct(oil5d),   tone: oil5d > 5 ? "bad" : "neutral" },
        { label: "VIX",       value: vixLast.toFixed(2), tone: vixLast > 25 ? "bad" : vixLast > 20 ? "warn" : "good" },
      ],
      signal,
      whatToDo,
    }
  } catch {
    return { id: "geopolitical", label: "Geopolitical Risk", emoji: "🌍", level: "LOW", score: 0, metrics: [], signal: "Data unavailable", whatToDo: "—" }
  }
}

async function dollarFactor(): Promise<RiskFactor> {
  try {
    const dxy = await getYahooCandles("DX-Y.NYB", "3mo", "1d").catch(() => null)
    const dxyLast = dxy ? lastVal(dxy.c) : 0
    const dxy5d   = dxy ? pctChange(dxy.c, 5) : 0
    const dxy20d  = dxy ? pctChange(dxy.c, 20) : 0

    // Strong DXY = bad for EM, commodities, US multinationals
    let score = 1
    if (dxy5d > 1)   score = 3
    if (dxy5d > 2)   score = 5
    if (dxy5d > 3)   score = 7
    if (dxy20d > 5)  score = Math.max(score, 6)

    const signal =
      dxy5d > 2   ? "DXY surging — risk-off / dollar squeeze active"
      : dxy20d > 5 ? "Dollar strong — pressure on EM and commodities"
      : dxy5d < -2 ? "DXY weakening — risk-on flows / commodities tailwind"
      : "Dollar range-bound — neutral for global risk assets"

    const whatToDo =
      dxy5d > 2 || dxy20d > 5
        ? "Avoid EM (EEM, FXI) · Trim US multinationals · Avoid commodities · USD positive"
        : dxy5d < -2
        ? "EM and commodities favored · Gold/silver tailwind"
        : "Neutral USD positioning"

    return {
      id: "dollar",
      label: "Dollar Strength (DXY)",
      emoji: "💵",
      level: levelFromScore(score),
      score,
      metrics: [
        { label: "DXY",       value: dxyLast.toFixed(2), tone: "neutral" },
        { label: "DXY 5d",    value: fmtPct(dxy5d),  tone: dxy5d > 1.5 ? "warn" : "neutral" },
        { label: "DXY 20d",   value: fmtPct(dxy20d), tone: dxy20d > 4 ? "warn" : "neutral" },
      ],
      signal,
      whatToDo,
    }
  } catch {
    return { id: "dollar", label: "Dollar Strength", emoji: "💵", level: "LOW", score: 0, metrics: [], signal: "Data unavailable", whatToDo: "—" }
  }
}

async function cryptoFactor(): Promise<RiskFactor> {
  try {
    const btc = await getYahooCandles("BTC-USD", "3mo", "1d").catch(() => null)
    const btcPrice = btc ? lastVal(btc.c) : 0
    const btc5d    = btc ? pctChange(btc.c, 5) : 0
    const btc20d   = btc ? pctChange(btc.c, 20) : 0

    // BTC is risk-on barometer. Sharp drop = risk-off cascade
    let score = 1
    if (btc5d < -10) score = 6
    if (btc5d < -15) score = 8
    if (btc20d < -20) score = Math.max(score, 7)
    // Sharp pump can also signal froth
    if (btc5d > 15)  score = Math.max(score, 4)

    const signal =
      btc5d < -15 ? "BTC crashing — broad risk-off cascade likely"
      : btc5d < -10 ? "BTC weak — risk appetite cooling"
      : btc5d > 15  ? "BTC speculative pump — froth signal"
      : "Crypto risk appetite normal"

    const whatToDo =
      btc5d < -10
        ? "De-risk speculative names · Tighten stops on high-beta · Cash builds"
        : btc5d > 15
        ? "Avoid chasing momentum names · Watch for blow-off top in growth"
        : "Normal positioning"

    return {
      id: "crypto",
      label: "Crypto Risk Appetite",
      emoji: "₿",
      level: levelFromScore(score),
      score,
      metrics: [
        { label: "BTC",       value: `$${btcPrice.toFixed(0)}`, tone: "neutral" },
        { label: "BTC 5d",    value: fmtPct(btc5d),  tone: btc5d < -10 ? "bad" : btc5d > 15 ? "warn" : "neutral" },
        { label: "BTC 20d",   value: fmtPct(btc20d), tone: btc20d < -15 ? "bad" : "neutral" },
      ],
      signal,
      whatToDo,
    }
  } catch {
    return { id: "crypto", label: "Crypto Risk Appetite", emoji: "₿", level: "LOW", score: 0, metrics: [], signal: "Data unavailable", whatToDo: "—" }
  }
}

async function bondVolFactor(): Promise<RiskFactor> {
  try {
    const move = await getYahooCandles("^MOVE", "3mo", "1d").catch(() => null)
    const moveLast = move ? lastVal(move.c) : 0
    const move5d   = move ? pctChange(move.c, 5) : 0

    // MOVE (bond VIX): <90 = calm, 90-120 = elevated, >120 = high stress
    let score = 1
    if (moveLast > 90)  score = 4
    if (moveLast > 110) score = 6
    if (moveLast > 130) score = 8
    if (move5d > 15)    score = Math.max(score, 6)

    const signal =
      moveLast > 130 ? "Bond market in stress — liquidity cracks possible"
      : moveLast > 110 ? "Bond vol elevated — duration risk high"
      : "Bond market calm"

    const whatToDo =
      moveLast > 120
        ? "Avoid long-duration bonds · Watch banks for trouble · Increase cash"
        : moveLast > 100
        ? "Be cautious on duration"
        : "Normal bond exposure OK"

    return {
      id: "bondvol",
      label: "Bond Volatility (MOVE)",
      emoji: "📊",
      level: levelFromScore(score),
      score,
      metrics: [
        { label: "MOVE Index", value: moveLast.toFixed(1), tone: moveLast > 120 ? "bad" : moveLast > 100 ? "warn" : "good" },
        { label: "MOVE 5d",    value: fmtPct(move5d),  tone: move5d > 10 ? "warn" : "neutral" },
      ],
      signal,
      whatToDo,
    }
  } catch {
    return { id: "bondvol", label: "Bond Volatility", emoji: "📊", level: "LOW", score: 0, metrics: [], signal: "Data unavailable", whatToDo: "—" }
  }
}

// ─── Main detector ───────────────────────────────────────────────────────────

export async function detectMacroRisks(): Promise<MacroSnapshot> {
  const factors = await Promise.all([
    geopoliticalFactor(),
    oilEnergyFactor(),
    inflationFactor(),
    yieldCurveFactor(),
    dollarFactor(),
    bondVolFactor(),
    cryptoFactor(),
  ])

  // Weighted overall score
  const totalScore = factors.reduce((sum, f) => sum + f.score, 0)
  const avgScore = totalScore / factors.length
  const riskScore = Math.round(avgScore * 10) // 0-100

  const overallRisk =
    avgScore >= 7 ? "EXTREME" :
    avgScore >= 5 ? "HIGH" :
    avgScore >= 3 ? "MEDIUM" : "LOW"

  // Top concern = highest-scoring factor
  const top = [...factors].sort((a, b) => b.score - a.score)[0]

  return {
    overallRisk,
    riskScore,
    factors,
    topConcern: `${top.emoji} ${top.label}: ${top.signal}`,
    scannedAt: Date.now(),
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  Dalio Regime Detector — Growth × Inflation 4-quadrant (market-implied)
// ════════════════════════════════════════════════════════════════════════════
//
// Ray Dalio's "economic machine" frames asset returns by two axes: whether
// GROWTH and INFLATION are rising or falling. That gives 4 regimes, each with
// different asset winners. We infer the two axes from market-implied proxies
// (no economic-data feed needed):
//
//   Growth ↑    : copper/gold ratio rising, SPY uptrend, high-yield credit firm,
//                 yield curve steepening
//   Inflation ↑ : oil & copper rising, 10Y yield rising, gold rising
//
// NOT investment advice — these are fast market proxies, not official GDP/CPI.

export type RegimeAxisDir = "Rising" | "Falling"
export type RegimeKey = "goldilocks" | "reflation" | "stagflation" | "deflation"

export interface RegimeIndicator {
  label: string
  value: string
  vote: "up" | "down"     // contribution to its axis
}

export interface DalioRegime {
  available: boolean
  growthDir: RegimeAxisDir
  growthScore: number       // -100..100 (sign = direction, magnitude = conviction)
  inflationDir: RegimeAxisDir
  inflationScore: number
  regimeKey: RegimeKey
  regimeLabel: string
  emoji: string
  description: string
  favored: string[]
  avoid: string[]
  color: string             // tailwind text color
  growthIndicators: RegimeIndicator[]
  inflationIndicators: RegimeIndicator[]
  scannedAt: number
}

const REGIME_META: Record<RegimeKey, Omit<DalioRegime, "available" | "growthDir" | "growthScore" | "inflationDir" | "inflationScore" | "regimeKey" | "growthIndicators" | "inflationIndicators" | "scannedAt">> = {
  goldilocks: {
    regimeLabel: "Goldilocks · Growth↑ Inflation↓",
    emoji: "🌤️",
    description: "เศรษฐกิจโตโดยเงินเฟ้อลด — สภาพแวดล้อมดีที่สุดสำหรับสินทรัพย์เสี่ยง",
    favored: ["หุ้นเติบโต/เทค", "US equities", "Credit/High-yield", "Long-duration growth"],
    avoid: ["เงินสดเยอะ", "สินค้าโภคภัณฑ์", "ทองคำสัดส่วนสูง"],
    color: "text-emerald-400",
  },
  reflation: {
    regimeLabel: "Reflation / Overheating · Growth↑ Inflation↑",
    emoji: "🔥",
    description: "โตพร้อมเงินเฟ้อเร่ง — ของจริง/วัฏจักรนำ พันธบัตรยาวเสียเปรียบ",
    favored: ["Value/Cyclicals", "Energy & Materials", "Commodities", "TIPS", "EM"],
    avoid: ["พันธบัตรระยะยาว", "หุ้น P/E สูงมาก", "Duration"],
    color: "text-orange-400",
  },
  stagflation: {
    regimeLabel: "Stagflation · Growth↓ Inflation↑",
    emoji: "🥵",
    description: "โตช้าแต่เงินเฟ้อยังสูง — สภาพแวดล้อมยากสุด เน้นป้องกัน + ของจริง",
    favored: ["ทองคำ/เงิน", "Commodities & Energy", "Defensives", "เงินสด", "TIPS"],
    avoid: ["หุ้นเติบโต", "Cyclicals", "พันธบัตรยาว", "High-beta"],
    color: "text-red-400",
  },
  deflation: {
    regimeLabel: "Deflation / Recession · Growth↓ Inflation↓",
    emoji: "❄️",
    description: "ชะลอตัวพร้อมเงินเฟ้อลด — พันธบัตรคุณภาพและของป้องกันชนะ",
    favored: ["พันธบัตรรัฐระยะยาว (TLT)", "Quality/Defensives", "เงินสด", "Staples/Utilities"],
    avoid: ["Cyclicals", "Commodities", "High-beta", "Credit เสี่ยง"],
    color: "text-sky-400",
  },
}

function regimeKeyFor(growthUp: boolean, inflUp: boolean): RegimeKey {
  if (growthUp && !inflUp) return "goldilocks"
  if (growthUp && inflUp)  return "reflation"
  if (!growthUp && inflUp) return "stagflation"
  return "deflation"
}

export async function detectDalioRegime(): Promise<DalioRegime> {
  const [spy, hyg, copper, gold, oil, tnx, irx] = await Promise.all([
    getYahooCandles("SPY",  "6mo", "1d").catch(() => null),
    getYahooCandles("HYG",  "6mo", "1d").catch(() => null),
    getYahooCandles("HG=F", "6mo", "1d").catch(() => null),
    getYahooCandles("GC=F", "6mo", "1d").catch(() => null),
    getYahooCandles("CL=F", "6mo", "1d").catch(() => null),
    getYahooCandles("^TNX", "6mo", "1d").catch(() => null),
    getYahooCandles("^IRX", "6mo", "1d").catch(() => null),
  ])

  const cu20 = copper ? pctChange(copper.c, 20) : null
  const au20 = gold   ? pctChange(gold.c, 20)   : null
  const spy60 = spy   ? pctChange(spy.c, 60)    : null
  const hyg20 = hyg   ? pctChange(hyg.c, 20)    : null
  const oil20 = oil   ? pctChange(oil.c, 20)    : null
  const tnx20 = tnx   ? pctChange(tnx.c, 20)    : null

  // Yield-curve steepening: (10Y−3M) now vs 20 sessions ago
  let curveSteepening: number | null = null
  if (tnx && irx && tnx.c.length > 21 && irx.c.length > 21) {
    const spreadNow = lastVal(tnx.c) - lastVal(irx.c)
    const spreadPrior = tnx.c[tnx.c.length - 21] - irx.c[irx.c.length - 21]
    curveSteepening = spreadNow - spreadPrior
  }

  // ── Growth axis ──
  const growthIndicators: RegimeIndicator[] = []
  const gVotes: number[] = []
  if (cu20 != null && au20 != null) {
    const rel = cu20 - au20
    growthIndicators.push({ label: "Copper/Gold ratio (20d)", value: `${rel >= 0 ? "+" : ""}${rel.toFixed(1)}%`, vote: rel >= 0 ? "up" : "down" })
    gVotes.push(rel >= 0 ? 1 : -1)
  }
  if (spy60 != null) {
    growthIndicators.push({ label: "SPY trend (60d)", value: fmtPct(spy60), vote: spy60 >= 0 ? "up" : "down" })
    gVotes.push(spy60 >= 0 ? 1 : -1)
  }
  if (hyg20 != null) {
    growthIndicators.push({ label: "High-yield credit HYG (20d)", value: fmtPct(hyg20), vote: hyg20 >= 0 ? "up" : "down" })
    gVotes.push(hyg20 >= 0 ? 1 : -1)
  }
  if (curveSteepening != null) {
    growthIndicators.push({ label: "Yield curve steepening (10Y−3M, 20d)", value: `${curveSteepening >= 0 ? "+" : ""}${curveSteepening.toFixed(2)}pp`, vote: curveSteepening >= 0 ? "up" : "down" })
    gVotes.push(curveSteepening >= 0 ? 1 : -1)
  }

  // ── Inflation axis ──
  const inflationIndicators: RegimeIndicator[] = []
  const iVotes: number[] = []
  if (oil20 != null) {
    inflationIndicators.push({ label: "Oil WTI (20d)", value: fmtPct(oil20), vote: oil20 >= 0 ? "up" : "down" })
    iVotes.push(oil20 >= 0 ? 1 : -1)
  }
  if (cu20 != null) {
    inflationIndicators.push({ label: "Copper (20d)", value: fmtPct(cu20), vote: cu20 >= 0 ? "up" : "down" })
    iVotes.push(cu20 >= 0 ? 1 : -1)
  }
  if (tnx20 != null) {
    inflationIndicators.push({ label: "10Y yield momentum (20d)", value: fmtPct(tnx20), vote: tnx20 >= 0 ? "up" : "down" })
    iVotes.push(tnx20 >= 0 ? 1 : -1)
  }
  if (au20 != null) {
    inflationIndicators.push({ label: "Gold (20d)", value: fmtPct(au20), vote: au20 >= 0 ? "up" : "down" })
    iVotes.push(au20 >= 0 ? 1 : -1)
  }

  if (gVotes.length < 2 || iVotes.length < 2) {
    return {
      available: false,
      growthDir: "Rising", growthScore: 0, inflationDir: "Rising", inflationScore: 0,
      regimeKey: "goldilocks", ...REGIME_META.goldilocks,
      growthIndicators, inflationIndicators, scannedAt: Date.now(),
    }
  }

  const growthScore = Math.round((gVotes.reduce((a, b) => a + b, 0) / gVotes.length) * 100)
  const inflationScore = Math.round((iVotes.reduce((a, b) => a + b, 0) / iVotes.length) * 100)
  const growthUp = growthScore >= 0
  const inflUp = inflationScore >= 0
  const key = regimeKeyFor(growthUp, inflUp)

  return {
    available: true,
    growthDir: growthUp ? "Rising" : "Falling",
    growthScore,
    inflationDir: inflUp ? "Rising" : "Falling",
    inflationScore,
    regimeKey: key,
    ...REGIME_META[key],
    growthIndicators,
    inflationIndicators,
    scannedAt: Date.now(),
  }
}
