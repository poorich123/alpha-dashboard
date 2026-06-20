/**
 * Position De-risk Engine
 * ─────────────────────────
 * Per-holding "is the thesis breaking?" monitor that fires BEFORE the obvious
 * crash, by combining leading + early-coincident tells from free, credible data:
 *
 *   • Supply-chain upstream (ASML/TSM/equip) rolling over   ← leading (sector)
 *   • Relative-strength breakdown vs SPY                     ← leading (distribution)
 *   • Trend structure break (lost EMA50/EMA200, lower lows)  ← early coincident
 *   • Below the user's own stop                              ← hard trigger
 *
 * Produces a graded signal (OK/WATCH/DE-RISK/CUT) + a tighter suggested stop, and
 * (via checkPositionDeRisk) turns escalations into portfolio alerts.
 *
 * NOT investment advice — a risk overlay to act earlier than the crowd.
 */

import { getYahooCandles } from "./yfinance"
import { calculateEMA } from "./technical"
import { isAISemiDownstream, type SupplyChainSnapshot } from "./supplyChain"
import { fetchFundamentals, type FundamentalsRaw } from "./fairValue"
import type { Position } from "@/types"
import type { NewsAlert } from "@/store/alertStore"

export type DeRiskLevel = "OK" | "WATCH" | "DE-RISK" | "CUT"
export type RiskDriver = "none" | "technical" | "thesis" | "both"

export interface PositionRiskSignal {
  ticker: string
  level: DeRiskLevel
  score: number              // 0-100 (max of the two dimensions, for display/sort)
  technicalScore: number     // 0-100 — price/structure breakdown
  thesisScore: number        // 0-100 — business "ไส้ใน" deterioration
  driver: RiskDriver         // which dimension is driving the level
  technicalReasons: string[]
  thesisReasons: string[]
  summary: string            // human one-liner (e.g. "เทคนิคัลอ่อน แต่พื้นฐานยังดี")
  suggestedAction: string
  suggestedStop: number | null
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
function pctChange(arr: number[], lookback: number): number {
  if (arr.length < lookback + 1) return 0
  const a = arr[arr.length - 1], b = arr[arr.length - 1 - lookback]
  return b > 0 ? ((a - b) / b) * 100 : 0
}

/**
 * Two-dimensional scoring:
 *   • Technical = price/structure breakdown (is the chart breaking?)
 *   • Thesis    = business "ไส้ใน" deterioration (is the company actually weakening?)
 * The level comes from a matrix of both, so a technical dip on a fundamentally
 * strong name (e.g. META) is WATCH "technical-only", not a false CUT — while a
 * stock breaking on BOTH dimensions is a real CUT.
 */
export function analyzePositionRisk(args: {
  ticker: string
  currentPrice: number
  closes: number[]
  lows: number[]
  spyCloses: number[] | null
  supplyChain: SupplyChainSnapshot | null
  fundamentals: FundamentalsRaw | null
  userStop?: number
}): PositionRiskSignal {
  const { ticker, currentPrice, closes, lows, spyCloses, supplyChain, fundamentals, userStop } = args
  const technicalReasons: string[] = []
  const thesisReasons: string[] = []
  let technicalScore = 0
  let thesisScore = 0

  const e50arr = calculateEMA(closes, 50)
  const e200arr = calculateEMA(closes, 200)
  const ema50 = e50arr.length ? e50arr[e50arr.length - 1] : currentPrice
  const ema200 = e200arr.length ? e200arr[e200arr.length - 1] : currentPrice

  // ════ TECHNICAL dimension (chart/structure) ════
  if (currentPrice < ema50) { technicalScore += 20; technicalReasons.push("หลุด EMA50 — เทรนด์สั้นเสีย") }
  if (currentPrice < ema200) { technicalScore += 25; technicalReasons.push("หลุด EMA200 — เทรนด์หลักเสีย") }

  if (lows.length >= 25) {
    const priorLow = Math.min(...lows.slice(-23, -3))
    if (currentPrice < priorLow) { technicalScore += 15; technicalReasons.push(`ทำ lower low หลุดแนวรับ $${priorLow.toFixed(2)}`) }
  }
  if (spyCloses && spyCloses.length > 21 && closes.length > 21) {
    const rs20 = pctChange(closes, 20) - pctChange(spyCloses, 20)
    if (rs20 < -8) { technicalScore += 18; technicalReasons.push(`RS อ่อนกว่าตลาด ${rs20.toFixed(0)}% (20d) — เริ่มถูกขายออก`) }
    else if (rs20 < -4) { technicalScore += 9; technicalReasons.push(`RS เริ่มอ่อนกว่าตลาด ${rs20.toFixed(0)}% (20d)`) }
  }
  const m20 = pctChange(closes, 20)
  if (m20 < -12) { technicalScore += 12; technicalReasons.push(`โมเมนตัม 20d ${m20.toFixed(0)}% — ขายแรง`) }
  if (userStop && userStop > 0 && currentPrice < userStop) {
    technicalScore += 30; technicalReasons.push(`หลุด stop ที่ตั้งไว้ $${userStop.toFixed(2)} — ควร cut ตามแผน`)
  }
  technicalScore = clamp(technicalScore, 0, 100)

  // ════ THESIS dimension (business internals) ════
  if (fundamentals) {
    const f = fundamentals
    if (f.revenueGrowth != null) {
      if (f.revenueGrowth < -0.05) { thesisScore += 30; thesisReasons.push(`รายได้หด ${(f.revenueGrowth * 100).toFixed(0)}% — ธุรกิจถดถอย`) }
      else if (f.revenueGrowth < 0.03) { thesisScore += 12; thesisReasons.push(`รายได้แทบไม่โต (${(f.revenueGrowth * 100).toFixed(0)}%)`) }
    }
    if (f.earningsGrowth != null && f.earningsGrowth < 0) { thesisScore += 18; thesisReasons.push(`กำไรหด ${(f.earningsGrowth * 100).toFixed(0)}%`) }
    if (f.freeCashflow != null && f.freeCashflow < 0) { thesisScore += 15; thesisReasons.push("FCF ติดลบ — เผาเงินสด") }
    if (f.nextYearGrowth != null && f.nextYearGrowth < 0) { thesisScore += 15; thesisReasons.push("นักวิเคราะห์คาดรายได้ปีหน้าหด") }
    // Analyst consensus: above target = limited upside / priced for perfection;
    // well below target = the Street still sees upside → reduces thesis risk.
    if (f.targetMeanPrice != null && currentPrice > 0) {
      const upside = (f.targetMeanPrice - currentPrice) / currentPrice
      if (upside < -0.15) { thesisScore += 18; thesisReasons.push(`ราคาสูงกว่าเป้านักวิเคราะห์ ${(-upside * 100).toFixed(0)}% — upside จำกัด`) }
      else if (upside < 0) { thesisScore += 8; thesisReasons.push("ราคาเลยเป้านักวิเคราะห์แล้ว") }
      else if (upside > 0.20) { thesisScore -= 15; thesisReasons.push(`นักวิเคราะห์ยังมองมี upside +${(upside * 100).toFixed(0)}% — พื้นฐานหนุน`) }
    }
  }
  // Supply-chain (demand environment) is a thesis-level tell for AI-semi downstream
  if (supplyChain?.available && supplyChain.deRiskLevel > 0 && isAISemiDownstream(ticker)) {
    thesisScore += Math.round(supplyChain.deRiskLevel * 22)
    thesisReasons.push(`ต้นน้ำ AI/semi อ่อน (${supplyChain.regime} ${supplyChain.score}) — demand เสี่ยง`)
  }
  thesisScore = clamp(thesisScore, 0, 100)

  // ════ Decision matrix ════
  let level: DeRiskLevel
  let driver: RiskDriver
  if (thesisScore >= 50 && technicalScore >= 45) { level = "CUT"; driver = "both" }
  else if (thesisScore >= 45) { level = "DE-RISK"; driver = "thesis" }
  else if (technicalScore >= 45 && thesisScore < 30) { level = "WATCH"; driver = "technical" }
  else if (technicalScore >= 45) { level = "DE-RISK"; driver = "both" }
  else if (technicalScore >= 25 || thesisScore >= 30) { level = "WATCH"; driver = thesisScore > technicalScore ? "thesis" : "technical" }
  else { level = "OK"; driver = "none" }

  const score = Math.max(technicalScore, thesisScore)

  const swingLow = lows.length >= 10 ? Math.min(...lows.slice(-10)) : currentPrice * 0.95
  const stopCands = [swingLow, ema50].filter(v => v > 0 && v < currentPrice)
  const suggestedStop = stopCands.length ? Math.max(...stopCands) * 0.99 : null

  const summary =
    driver === "both" ? "ทั้งราคาและพื้นฐานเริ่มเสีย — สัญญาณ cut จริง"
    : driver === "thesis" ? "พื้นฐาน (ไส้ใน) เริ่มเสีย — ระวัง ก่อนราคาตามมา"
    : driver === "technical" ? "เทคนิคัลอ่อน แต่พื้นฐานยังดี — น่าจะ rotation/พักฐาน ไม่ใช่ thesis พัง"
    : "ปกติ"

  const suggestedAction =
    level === "CUT" ? "Cut หรือลดไม้ส่วนใหญ่ — ทั้งราคาและธุรกิจเสียพร้อมกัน"
    : level === "DE-RISK" && driver === "thesis" ? "ไส้ในเริ่มเสีย — ลดไม้ก่อนราคาตามมา (cut ก่อนตลาด)"
    : level === "DE-RISK" ? `ลดไม้บางส่วน + กระชับ stop ขึ้นมาที่ ~$${suggestedStop?.toFixed(2) ?? "-"}`
    : level === "WATCH" && driver === "technical" ? "อย่าเพิ่ง cut — พื้นฐานยังดี · ตั้ง stop ไว้ ถ้าหลุดค่อยลด"
    : level === "WATCH" ? "จับตาใกล้ชิด — ถ้าสัญญาณเพิ่มให้ลดไม้"
    : "ถือได้ตามแผน"

  return {
    ticker, level, score, technicalScore, thesisScore, driver,
    technicalReasons, thesisReasons, summary, suggestedAction, suggestedStop,
  }
}

// ─── Alert generation (called from the monitoring loop) ───────────────────────

const ALERT_SOURCE = "Position Risk Engine"
const DEDUP_MS = 6 * 60 * 60 * 1000  // don't re-alert same ticker within 6h unless escalated

/**
 * Scan active holdings → full per-ticker risk signals (for portfolio badges)
 * plus the subset of escalations turned into alerts (throttled + deduped).
 */
export async function scanPositionRisk(
  positions: Position[],
  supplyChain: SupplyChainSnapshot | null,
  existingAlerts: NewsAlert[],
): Promise<{ signals: Record<string, PositionRiskSignal>; alerts: NewsAlert[] }> {
  const holdings = positions.filter(p => p.isActive && p.category !== "watchlist")
  if (holdings.length === 0) return { signals: {}, alerts: [] }

  // SPY once for relative strength
  let spyCloses: number[] | null = null
  try { spyCloses = (await getYahooCandles("SPY", "1y", "1d")).c } catch { /* ignore */ }

  const signals: Record<string, PositionRiskSignal> = {}
  const alerts: NewsAlert[] = []
  const now = Date.now()

  let i = 0
  for (const p of holdings) {
    try {
      const candle = await getYahooCandles(p.ticker, "1y", "1d")
      if (!candle || candle.c.length < 30) continue
      const price = candle.c[candle.c.length - 1]

      // Fundamentals for the thesis dimension (best-effort — ETF/ADR may lack it)
      let fundamentals: FundamentalsRaw | null = null
      try { fundamentals = await fetchFundamentals(p.ticker) } catch { /* ignore */ }

      const sig = analyzePositionRisk({
        ticker: p.ticker, currentPrice: price,
        closes: candle.c, lows: candle.l, spyCloses,
        supplyChain, fundamentals, userStop: p.stopLoss,
      })
      signals[p.ticker.toUpperCase()] = sig

      // Throttle (every other holding) to stay gentle on the APIs
      if (++i % 3 === 0) await new Promise(r => setTimeout(r, 300))

      // Only alert on a genuine de-risk: CUT, or a thesis-driven DE-RISK.
      // A technical-only DE-RISK is downgraded to WATCH by the matrix already,
      // so DE-RISK here means thesis or both — worth an alert.
      if (sig.level !== "DE-RISK" && sig.level !== "CUT") continue

      // Dedup: skip if a same/higher de-risk alert for this ticker fired recently
      const recent = existingAlerts.find(a =>
        a.source === ALERT_SOURCE &&
        a.tickers.includes(p.ticker) &&
        now - a.timestamp < DEDUP_MS &&
        (a.impact === "CRITICAL" || sig.level === "DE-RISK"),  // CUT can override a prior DE-RISK
      )
      if (recent) continue

      const reasons = [...sig.thesisReasons, ...sig.technicalReasons]
      alerts.push({
        id: `derisk-${p.ticker}-${now}`,
        timestamp: now,
        tickers: [p.ticker],
        headline: `⚠️ De-risk ${p.ticker}: ${sig.level} (${sig.driver}) — ${sig.summary}`,
        source: ALERT_SOURCE,
        url: `/analyzer?ticker=${encodeURIComponent(p.ticker)}`,
        impact: sig.level === "CUT" ? "CRITICAL" : "HIGH",
        sentiment: "BEARISH",
        type: "PORTFOLIO",
        portfolioAssessment: `Technical ${sig.technicalScore} · Thesis ${sig.thesisScore} · ${reasons.join(" · ")}`,
        immediateAction: sig.suggestedAction,
        swingSetups: [],
        read: false,
      })
    } catch { /* skip ticker */ }
  }

  return { signals, alerts }
}
