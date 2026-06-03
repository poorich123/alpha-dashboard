/**
 * Bubble Score — Dalio 6-point bubble gauge, adapted per-stock
 * ─────────────────────────────────────────────────────────────
 * Ray Dalio's bubble framework asks 6 questions. Originally market-level; here
 * we adapt each to a single stock using data we already fetch (technical result
 * + fundamentals + fair value). Higher score = more bubble-like risk.
 *
 *   1. Valuation Stretch   — prices high vs traditional measures (MoS / P/E)
 *   2. Growth Expectations — unsustainable growth priced in (PEG / fwd P/E)
 *   3. Price Extension     — run-up far above trend (vs SMA200, 1Y, 52w high)
 *   4. Overbought Sentiment— broadly bullish (RSI, Bollinger %B)
 *   5. Volatility/Leverage — speculative/leveraged buying proxy (beta + realized σ)
 *   6. Parabolic Move      — speculative acceleration (short-TF >> long-TF, volume)
 *
 * NOT investment advice. Point 5 is a per-stock proxy for a market-level concept.
 * Gauges with missing data are excluded (not penalized).
 */

import { calculateRSI } from "./technical"
import type { AnalyzerResult } from "./stockAnalyzer"
import type { FairValueResult } from "./fairValue"
import type { FundamentalsRaw } from "./fairValue"

export type BubbleLevel = "Low" | "Moderate" | "Frothy" | "Elevated" | "Bubble Risk"

export interface BubbleGauge {
  key: string
  label: string              // Thai display label
  score: number              // 0-100 risk (higher = more bubble)
  note: string               // short Thai explanation of the reading
}

export interface BubbleScoreResult {
  available: boolean
  overall: number            // 0-100 blended
  level: BubbleLevel
  color: string              // tailwind text color
  gauges: BubbleGauge[]
  summary: string
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v))

// Map a value through piecewise breakpoints [input, output] (ascending input).
function piecewise(x: number, points: [number, number][]): number {
  if (x <= points[0][0]) return points[0][1]
  const last = points[points.length - 1]
  if (x >= last[0]) return last[1]
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1]
    const [x1, y1] = points[i]
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0)
  }
  return last[1]
}

function realizedVol(closes: number[]): number {
  if (closes.length < 30) return 0
  const slice = closes.slice(-126)  // ~6 months
  const rets: number[] = []
  for (let i = 1; i < slice.length; i++) rets.push(Math.log(slice[i] / slice[i - 1]))
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length
  const variance = rets.reduce((a, r) => a + (r - mean) ** 2, 0) / rets.length
  return Math.sqrt(variance) * Math.sqrt(252)  // annualized
}

function levelFor(score: number): { level: BubbleLevel; color: string } {
  if (score >= 78) return { level: "Bubble Risk", color: "text-red-400" }
  if (score >= 62) return { level: "Elevated",    color: "text-orange-400" }
  if (score >= 45) return { level: "Frothy",      color: "text-yellow-400" }
  if (score >= 25) return { level: "Moderate",    color: "text-green-400" }
  return { level: "Low", color: "text-emerald-400" }
}

export function computeBubbleScore(
  analyzer: AnalyzerResult,
  fairValue: FairValueResult | null,
  fundamentals: FundamentalsRaw | null,
): BubbleScoreResult {
  const snap = analyzer.snapshot
  const price = snap.currentPrice
  const closes = analyzer.candles.c
  const gauges: { gauge: BubbleGauge; weight: number }[] = []

  // ── 1. Valuation Stretch ──────────────────────────────────────────────────
  if (fairValue?.available && fairValue.marginOfSafety != null) {
    const mos = fairValue.marginOfSafety
    const score = clamp(40 - mos * 150)
    gauges.push({
      weight: 0.25,
      gauge: {
        key: "valuation", label: "1. มูลค่าแพง (Valuation)",
        score,
        note: `Margin of Safety ${(mos * 100).toFixed(0)}% · ${mos < -0.2 ? "ราคาสูงกว่ามูลค่าพื้นฐานมาก" : mos < 0 ? "ราคาสูงกว่ามูลค่าเล็กน้อย" : "ยังมีส่วนเผื่อความปลอดภัย"}`,
      },
    })
  } else {
    const pe = fundamentals?.trailingPE ?? snap.peRatio ?? null
    if (pe != null && pe > 0) {
      const score = piecewise(pe, [[10, 10], [15, 25], [25, 45], [40, 75], [60, 95], [100, 100]])
      gauges.push({
        weight: 0.25,
        gauge: { key: "valuation", label: "1. มูลค่าแพง (Valuation)", score, note: `P/E ${pe.toFixed(1)}× ${pe > 40 ? "(สูงมาก)" : pe > 25 ? "(ค่อนข้างสูง)" : "(พอรับได้)"}` },
      })
    }
  }

  // ── 2. Growth Expectations ────────────────────────────────────────────────
  const peg = fundamentals?.pegRatio ?? null
  if (peg != null && peg > 0) {
    const score = piecewise(peg, [[0.8, 15], [1, 30], [1.5, 50], [2, 70], [3, 95], [5, 100]])
    gauges.push({
      weight: 0.20,
      gauge: { key: "growth", label: "2. คาดหวังโตเกินจริง (Growth)", score, note: `PEG ${peg.toFixed(2)} ${peg > 2 ? "— ราคาสะท้อนการเติบโตสูงมาก" : peg > 1 ? "— เริ่มแพงเทียบการเติบโต" : "— ยังสมเหตุผล"}` },
    })
  } else {
    const fpe = fundamentals?.forwardPE ?? null
    const g = (fundamentals?.earningsGrowth ?? fundamentals?.revenueGrowth ?? 0) * 100
    if (fpe != null && fpe > 0 && g > 0) {
      const impliedPeg = fpe / g
      const score = piecewise(impliedPeg, [[0.8, 15], [1.5, 50], [3, 95]])
      gauges.push({
        weight: 0.20,
        gauge: { key: "growth", label: "2. คาดหวังโตเกินจริง (Growth)", score, note: `Fwd P/E ${fpe.toFixed(1)}× vs growth ${g.toFixed(0)}%` },
      })
    }
  }

  // ── 3. Price Extension ────────────────────────────────────────────────────
  if (snap.sma200 > 0) {
    const aboveSma = (price / snap.sma200 - 1)
    const extScore = clamp(aboveSma * 150)
    const oneYr = analyzer.trendGauges.find(g => g.timeframe === "1Y")?.score ?? 50
    const near52w = snap.week52High > 0 ? clamp((price / snap.week52High) * 100) : 50
    const score = clamp(0.5 * extScore + 0.3 * oneYr + 0.2 * near52w)
    gauges.push({
      weight: 0.20,
      gauge: { key: "extension", label: "3. ราคาวิ่งไกลจากเทรนด์ (Extension)", score, note: `+${(aboveSma * 100).toFixed(0)}% เหนือ SMA200 · ${(price / snap.week52High * 100).toFixed(0)}% ของ 52w high` },
    })
  }

  // ── 4. Overbought Sentiment ───────────────────────────────────────────────
  if (closes.length >= 20) {
    const rsi = calculateRSI(closes)
    const pctB = analyzer.entryRec.pctB
    let score = piecewise(rsi, [[40, 10], [50, 30], [60, 50], [70, 75], [80, 100]])
    if (pctB > 1) score = clamp(score + 15)
    else if (pctB > 0.9) score = clamp(score + 8)
    gauges.push({
      weight: 0.15,
      gauge: { key: "sentiment", label: "4. แรงซื้อร้อนแรง (Overbought)", score, note: `RSI ${rsi.toFixed(0)} · %B ${pctB.toFixed(2)}${pctB > 1 ? " (ทะลุ upper band)" : ""}` },
    })
  }

  // ── 5. Volatility / Leverage proxy ────────────────────────────────────────
  const beta = fundamentals?.beta ?? null
  const vol = realizedVol(closes)
  if (beta != null || vol > 0) {
    const betaScore = beta != null ? piecewise(beta, [[0.8, 20], [1, 40], [1.5, 60], [2, 80], [3, 100]]) : 50
    const volScore = vol > 0 ? piecewise(vol, [[0.2, 20], [0.4, 50], [0.6, 75], [0.9, 100]]) : 50
    const score = clamp(beta != null && vol > 0 ? 0.5 * betaScore + 0.5 * volScore : beta != null ? betaScore : volScore)
    gauges.push({
      weight: 0.10,
      gauge: { key: "volatility", label: "5. ความผันผวน/เลเวอเรจ (proxy)", score, note: `${beta != null ? `β ${beta.toFixed(2)}` : ""}${beta != null && vol > 0 ? " · " : ""}${vol > 0 ? `vol ${(vol * 100).toFixed(0)}%/ปี` : ""} — proxy ระดับการเก็งกำไร` },
    })
  }

  // ── 6. Parabolic Move ─────────────────────────────────────────────────────
  const g1W = analyzer.trendGauges.find(g => g.timeframe === "1W")?.score ?? 50
  const g1M = analyzer.trendGauges.find(g => g.timeframe === "1M")?.score ?? 50
  const g6M = analyzer.trendGauges.find(g => g.timeframe === "6M")?.score ?? 50
  {
    // Acceleration: short-term momentum running hotter than the longer trend.
    const accel = (g1W + g1M) / 2 - g6M
    const vol5 = analyzer.candles.v.slice(-5).reduce((a, b) => a + b, 0) / 5
    const vol20 = analyzer.candles.v.slice(-20).reduce((a, b) => a + b, 0) / 20
    const volSurge = vol20 > 0 ? vol5 / vol20 : 1
    let score = clamp(((g1W + g1M) / 2 - 50) * 1.4)
    if (accel > 10) score = clamp(score + 15)
    if (volSurge > 1.5) score = clamp(score + 12)
    if (snap.changePct > 8) score = clamp(score + 10)
    gauges.push({
      weight: 0.10,
      gauge: { key: "parabolic", label: "6. เร่งตัวแบบพาราโบลา (Parabolic)", score, note: `momentum สั้น ${((g1W + g1M) / 2).toFixed(0)} vs 6M ${g6M.toFixed(0)}${volSurge > 1.5 ? ` · vol surge ${volSurge.toFixed(1)}×` : ""}` },
    })
  }

  if (gauges.length === 0) {
    return { available: false, overall: 0, level: "Low", color: "text-gray-400", gauges: [], summary: "ข้อมูลไม่พอประเมิน bubble score" }
  }

  const totalW = gauges.reduce((s, g) => s + g.weight, 0)
  const overall = Math.round(gauges.reduce((s, g) => s + g.gauge.score * (g.weight / totalW), 0))
  const { level, color } = levelFor(overall)

  const hot = gauges.filter(g => g.gauge.score >= 70).map(g => g.gauge.label.replace(/^\d+\.\s*/, "").replace(/\s*\(.*\)/, ""))
  const summary =
    overall >= 62
      ? `สัญญาณ bubble ${level} — เด่นที่: ${hot.join(", ") || "หลายด้าน"} · ระวังการไล่ราคา`
      : overall >= 45
      ? `เริ่มมีความร้อนแรง (${level}) — ${hot.length ? "จับตา: " + hot.join(", ") : "ยังไม่สุดโต่ง"}`
      : `ความเสี่ยง bubble ต่ำ (${level}) — ราคายังไม่สุดโต่งเทียบปัจจัยพื้นฐาน/เทคนิคัล`

  return { available: true, overall, level, color, gauges: gauges.map(g => g.gauge), summary }
}
