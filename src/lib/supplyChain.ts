/**
 * Supply-Chain Bellwether → De-risk Engine
 * ──────────────────────────────────────────
 * "Watch the headwaters." Small/mid AI-semi names are downstream beneficiaries
 * of Big-Tech capex. Before that capex slows, the UPSTREAM tells (litho monopoly
 * ASML, foundry #1 TSMC, and the wafer-fab-equipment trio AMAT/LRCX/KLAC) roll
 * over first. So instead of waiting for a small cap to report, we track the
 * bellwethers and, when they break trend, raise a de-risk flag that tightens
 * stops / shrinks size for downstream AI-semi positions.
 *
 * No scraping / no pipeline — computed on demand from the same Yahoo candles the
 * rest of the app uses (cached). NOT investment advice.
 */

import { getYahooCandles } from "./yfinance"
import { calculateEMA } from "./technical"
import { SECTOR_GROUPS } from "./stockLists"

export interface Bellwether {
  ticker: string
  role: string
  weight: number             // ASML/TSM weigh more — the truest tells
}

/** Upstream tells, ordered by signal purity. */
export const SUPPLY_CHAIN_BELLWETHERS: Bellwether[] = [
  { ticker: "ASML", role: "Litho monopoly (EUV)", weight: 1.6 },
  { ticker: "TSM",  role: "Foundry #1",            weight: 1.6 },
  { ticker: "AMAT", role: "Wafer-fab equipment",   weight: 1.2 },
  { ticker: "LRCX", role: "Etch / deposition",     weight: 1.1 },
  { ticker: "KLAC", role: "Process control",       weight: 1.0 },
  { ticker: "AVGO", role: "AI networking / custom silicon", weight: 1.1 },
  { ticker: "NVDA", role: "AI demand anchor",      weight: 1.2 },
]

export type SupplyChainRegime = "HEALTHY" | "COOLING" | "DETERIORATING" | "BREAKING"

export interface BellwetherState {
  ticker: string
  role: string
  price: number
  mom20: number              // % change 20d
  mom60: number              // % change 60d
  aboveEma50: boolean
  aboveEma200: boolean
  score: number              // 0-100 health
  trend30d: number[]
}

export interface SupplyChainSnapshot {
  available: boolean
  score: number              // 0-100 weighted health
  regime: SupplyChainRegime
  color: string              // tailwind text color
  deRiskLevel: number        // 0 (none) → 1 (max) — drives stop tightening / sizing
  bellwethers: BellwetherState[]
  headline: string
  guidance: string
  scannedAt: number
}

// ─── Downstream universe (who gets de-risked) ────────────────────────────────

const DOWNSTREAM = new Set<string>([
  ...(SECTOR_GROUPS.semi?.tickers ?? []),
  ...(SECTOR_GROUPS.datacenter?.tickers ?? []),
].map(t => t.toUpperCase()))

/** Is this ticker a downstream AI-semi name affected by upstream capex? */
export function isAISemiDownstream(ticker: string): boolean {
  return DOWNSTREAM.has(ticker.toUpperCase())
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pctChange(arr: number[], lookback: number): number {
  if (arr.length < lookback + 1) return 0
  const recent = arr[arr.length - 1]
  const prior = arr[arr.length - 1 - lookback]
  return prior > 0 ? ((recent - prior) / prior) * 100 : 0
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

function scoreBellwether(closes: number[]): { score: number; mom20: number; mom60: number; aboveEma50: boolean; aboveEma200: boolean } {
  const price = closes[closes.length - 1]
  const ema50 = calculateEMA(closes, 50)
  const ema200 = calculateEMA(closes, 200)
  const e50 = ema50.length ? ema50[ema50.length - 1] : price
  const e200 = ema200.length ? ema200[ema200.length - 1] : price
  const mom20 = pctChange(closes, 20)
  const mom60 = pctChange(closes, 60)
  const high52 = Math.max(...closes.slice(-252))

  let score = 50
  score += price > e50 ? 15 : -15
  score += e50 > e200 ? 10 : -10
  score += clamp(mom20 * 1.5, -15, 15)
  score += clamp(mom60 * 0.8, -15, 15)
  if (high52 > 0) {
    if (price >= high52 * 0.95) score += 10
    else if (price < high52 * 0.80) score -= 10
  }
  return {
    score: clamp(Math.round(score), 0, 100),
    mom20, mom60,
    aboveEma50: price > e50,
    aboveEma200: price > e200,
  }
}

function regimeFor(score: number): { regime: SupplyChainRegime; color: string } {
  if (score >= 70) return { regime: "HEALTHY",       color: "text-emerald-400" }
  if (score >= 55) return { regime: "COOLING",       color: "text-yellow-400" }
  if (score >= 40) return { regime: "DETERIORATING", color: "text-orange-400" }
  return { regime: "BREAKING", color: "text-red-400" }
}

// ─── Main detector ────────────────────────────────────────────────────────────

export async function detectSupplyChainHealth(): Promise<SupplyChainSnapshot> {
  const results = await Promise.allSettled(
    SUPPLY_CHAIN_BELLWETHERS.map(async (b) => {
      const candle = await getYahooCandles(b.ticker, "1y", "1d")
      if (!candle || candle.c.length < 60) throw new Error("insufficient")
      const s = scoreBellwether(candle.c)
      return {
        ticker: b.ticker, role: b.role,
        price: candle.c[candle.c.length - 1],
        mom20: s.mom20, mom60: s.mom60,
        aboveEma50: s.aboveEma50, aboveEma200: s.aboveEma200,
        score: s.score,
        trend30d: candle.c.slice(-30),
        weight: b.weight,
      }
    }),
  )

  const states = results
    .filter((r): r is PromiseFulfilledResult<BellwetherState & { weight: number }> => r.status === "fulfilled")
    .map(r => r.value)

  if (states.length < 3) {
    return {
      available: false, score: 0, regime: "HEALTHY", color: "text-gray-400",
      deRiskLevel: 0, bellwethers: [], headline: "ข้อมูลต้นน้ำไม่พอ", guidance: "—", scannedAt: Date.now(),
    }
  }

  const totalW = states.reduce((s, b) => s + b.weight, 0)
  const score = Math.round(states.reduce((s, b) => s + b.score * b.weight, 0) / totalW)
  const { regime, color } = regimeFor(score)
  const deRiskLevel = clamp((70 - score) / 40, 0, 1)  // 70→0, 30→1

  const weak = states.filter(b => b.score < 45).map(b => b.ticker)
  const headline =
    regime === "HEALTHY" ? "ต้นน้ำแข็งแรง — AI/semi capex ยังไหลลื่น"
    : regime === "COOLING" ? "ต้นน้ำเริ่มเย็นลง — เฝ้าระวัง"
    : regime === "DETERIORATING" ? `ต้นน้ำอ่อนแรง${weak.length ? " (" + weak.join(", ") + ")" : ""} — เริ่ม de-risk`
    : `ต้นน้ำหักหัวลง${weak.length ? " (" + weak.join(", ") + ")" : ""} — de-risk ด่วน`

  const guidance =
    regime === "HEALTHY" ? "ถือหุ้น AI/semi downstream ได้ตามปกติ · stop ปกติ"
    : regime === "COOLING" ? "ยังถือได้ แต่ไม่เพิ่มไม้ใหม่ก้าวร้าว · เริ่มกระชับ stop เล็กน้อย"
    : regime === "DETERIORATING" ? "กระชับ stop หุ้น AI/semi ขนาดเล็ก-กลาง + ลดขนาดไม้ · เลี่ยงไล่ราคา"
    : "ลดความเสี่ยงทันที: กระชับ stop ให้แคบ · ลดไม้ครึ่ง · รอ ASML/TSM กลับมายืนเหนือ EMA50 ก่อนกลับเข้า"

  const bellwethers: BellwetherState[] = states
    .map(({ weight: _w, ...rest }) => rest)
    .sort((a, b) => a.score - b.score)  // weakest first (most informative)

  return { available: true, score, regime, color, deRiskLevel, bellwethers, headline, guidance, scannedAt: Date.now() }
}

// ─── De-risk application (used by downstream AI-semi positions) ───────────────

/**
 * Tighten a stop toward price by the de-risk level. At max de-risk the stop
 * distance is halved (lock gains faster), per the "headwaters drying" rule.
 */
export function tightenStop(originalStop: number, price: number, deRiskLevel: number): number {
  if (deRiskLevel <= 0 || originalStop >= price) return originalStop
  const risk = price - originalStop
  const tightenedRisk = risk * (1 - deRiskLevel * 0.5)
  return price - tightenedRisk
}

/** Suggested position-size multiplier under de-risk (1 = full, 0.5 = half). */
export function deRiskSizeMultiplier(deRiskLevel: number): number {
  return clamp(1 - deRiskLevel * 0.5, 0.5, 1)
}
