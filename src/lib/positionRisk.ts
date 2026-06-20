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
import type { Position } from "@/types"
import type { NewsAlert } from "@/store/alertStore"

export type DeRiskLevel = "OK" | "WATCH" | "DE-RISK" | "CUT"

export interface PositionRiskSignal {
  ticker: string
  level: DeRiskLevel
  score: number              // 0-100 risk
  reasons: string[]
  suggestedAction: string
  suggestedStop: number | null
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
function pctChange(arr: number[], lookback: number): number {
  if (arr.length < lookback + 1) return 0
  const a = arr[arr.length - 1], b = arr[arr.length - 1 - lookback]
  return b > 0 ? ((a - b) / b) * 100 : 0
}

/** Pure scoring from candles + context. */
export function analyzePositionRisk(args: {
  ticker: string
  currentPrice: number
  closes: number[]
  lows: number[]
  spyCloses: number[] | null
  supplyChain: SupplyChainSnapshot | null
  userStop?: number
}): PositionRiskSignal {
  const { ticker, currentPrice, closes, lows, spyCloses, supplyChain, userStop } = args
  const reasons: string[] = []
  let score = 0

  const e50arr = calculateEMA(closes, 50)
  const e200arr = calculateEMA(closes, 200)
  const ema50 = e50arr.length ? e50arr[e50arr.length - 1] : currentPrice
  const ema200 = e200arr.length ? e200arr[e200arr.length - 1] : currentPrice

  // ── Trend-structure break (early coincident) ──
  if (currentPrice < ema50) { score += 20; reasons.push("หลุด EMA50 — เทรนด์สั้นเสีย") }
  if (currentPrice < ema200) { score += 25; reasons.push("หลุด EMA200 — เทรนด์หลักเสีย") }

  // Lower low: broke below the prior 20-day support (excluding the last 3 bars)
  if (lows.length >= 25) {
    const priorLow = Math.min(...lows.slice(-23, -3))
    if (currentPrice < priorLow) { score += 15; reasons.push(`ทำ lower low หลุดแนวรับ $${priorLow.toFixed(2)}`) }
  }

  // ── Relative-strength breakdown vs SPY (leading: distribution) ──
  if (spyCloses && spyCloses.length > 21 && closes.length > 21) {
    const rs20 = pctChange(closes, 20) - pctChange(spyCloses, 20)
    if (rs20 < -8) { score += 18; reasons.push(`RS อ่อนกว่าตลาด ${rs20.toFixed(0)}% (20d) — เริ่มถูกขายออก`) }
    else if (rs20 < -4) { score += 9; reasons.push(`RS เริ่มอ่อนกว่าตลาด ${rs20.toFixed(0)}% (20d)`) }
  }

  // Momentum rollover
  const m20 = pctChange(closes, 20)
  if (m20 < -12) { score += 12; reasons.push(`โมเมนตัม 20d ${m20.toFixed(0)}% — ขายแรง`) }

  // ── Supply-chain upstream (leading, for AI-semi downstream names) ──
  if (supplyChain?.available && supplyChain.deRiskLevel > 0 && isAISemiDownstream(ticker)) {
    score += Math.round(supplyChain.deRiskLevel * 25)
    reasons.push(`ต้นน้ำ AI/semi อ่อน (score ${supplyChain.score}, ${supplyChain.regime}) — capex จะแห้ง`)
  }

  // ── Below the user's own stop (hard trigger) ──
  if (userStop && userStop > 0 && currentPrice < userStop) {
    score += 30; reasons.push(`หลุด stop ที่ตั้งไว้ $${userStop.toFixed(2)} — ควร cut ตามแผน`)
  }

  score = clamp(score, 0, 100)
  const level: DeRiskLevel = score >= 65 ? "CUT" : score >= 45 ? "DE-RISK" : score >= 25 ? "WATCH" : "OK"

  // Suggested tighter stop = highest of (recent swing low, EMA50) just below price
  const swingLow = lows.length >= 10 ? Math.min(...lows.slice(-10)) : currentPrice * 0.95
  const stopCands = [swingLow, ema50].filter(v => v > 0 && v < currentPrice)
  const suggestedStop = stopCands.length ? Math.max(...stopCands) * 0.99 : null

  const suggestedAction =
    level === "CUT" ? "Cut หรือลดไม้ส่วนใหญ่ทันที — thesis เทคนิคัลเสียหลายจุด"
    : level === "DE-RISK" ? `ลดไม้บางส่วน + กระชับ stop ขึ้นมาที่ ~$${suggestedStop?.toFixed(2) ?? "-"}`
    : level === "WATCH" ? "จับตาใกล้ชิด — ถ้าหลุดแนวรับถัดไปให้ลดไม้"
    : "ถือได้ตามแผน"

  return { ticker, level, score, reasons, suggestedAction, suggestedStop }
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

  for (const p of holdings) {
    try {
      const candle = await getYahooCandles(p.ticker, "1y", "1d")
      if (!candle || candle.c.length < 30) continue
      const price = candle.c[candle.c.length - 1]

      const sig = analyzePositionRisk({
        ticker: p.ticker, currentPrice: price,
        closes: candle.c, lows: candle.l, spyCloses,
        supplyChain, userStop: p.stopLoss,
      })
      signals[p.ticker.toUpperCase()] = sig

      if (sig.level !== "DE-RISK" && sig.level !== "CUT") continue

      // Dedup: skip if a same/higher de-risk alert for this ticker fired recently
      const recent = existingAlerts.find(a =>
        a.source === ALERT_SOURCE &&
        a.tickers.includes(p.ticker) &&
        now - a.timestamp < DEDUP_MS &&
        (a.impact === "CRITICAL" || sig.level === "DE-RISK"),  // CUT can override a prior DE-RISK
      )
      if (recent) continue

      alerts.push({
        id: `derisk-${p.ticker}-${now}`,
        timestamp: now,
        tickers: [p.ticker],
        headline: `⚠️ De-risk ${p.ticker}: ${sig.level} — ${sig.reasons[0] ?? "thesis เริ่มเสีย"}`,
        source: ALERT_SOURCE,
        url: `/analyzer?ticker=${encodeURIComponent(p.ticker)}`,
        impact: sig.level === "CUT" ? "CRITICAL" : "HIGH",
        sentiment: "BEARISH",
        type: "PORTFOLIO",
        portfolioAssessment: `Risk ${sig.score}/100 · ${sig.reasons.join(" · ")}`,
        immediateAction: sig.suggestedAction,
        swingSetups: [],
        read: false,
      })
    } catch { /* skip ticker */ }
  }

  return { signals, alerts }
}
