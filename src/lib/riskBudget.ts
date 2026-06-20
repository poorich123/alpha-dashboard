/**
 * Portfolio Risk Budget
 * ───────────────────────
 * One view that synthesises everything: position weights × volatility (risk
 * contribution), concentration by bucket × internal correlation (is the
 * "diversification" real?), AI-semi supply-chain exposure, and the per-position
 * de-risk signals — into a prioritised "what to trim" list.
 *
 * Answers: ความเสี่ยงกระจุกตรงไหน · ตัวไหนกินงบความเสี่ยงมากสุด · ควรหั่นอะไรก่อน.
 */

import type { Position } from "@/types"
import type { PositionRiskSignal } from "./positionRisk"
import { isAISemiDownstream, type SupplyChainSnapshot } from "./supplyChain"
import { fetchAlignedReturns, correlationMatrix, avgBucketCorr, avgOverallCorr } from "./correlation"

export interface BucketRisk {
  bucket: string
  weightPct: number
  avgCorr: number          // NaN if <2 names
  count: number
  tickers: string[]
  concentrated: boolean
}

export interface PositionContribution {
  ticker: string
  sector: string
  category: string
  weightPct: number
  volAnnual: number        // realized annualized volatility (%)
  riskSharePct: number     // share of total portfolio risk
  deRiskLevel: string      // OK / WATCH / DE-RISK / CUT
  driver: string
  earningsInDays: number | null
  trim: boolean
  reasons: string[]
}

export interface RiskBudgetSnapshot {
  available: boolean
  totalValue: number
  positions: PositionContribution[]   // sorted by risk share desc
  sectorBuckets: BucketRisk[]
  categoryBuckets: BucketRisk[]
  overallCorr: number
  aiSemiExposurePct: number
  supplyChainRegime: string
  effectiveBets: number               // Herfindahl 1/Σw² — "real" # of positions
  diversificationNote: string
  trimSuggestions: string[]
  warnings: string[]
}

function stdev(arr: number[]): number {
  if (arr.length < 2) return 0
  const m = arr.reduce((a, b) => a + b, 0) / arr.length
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length)
}

function buildBuckets(
  contribs: PositionContribution[],
  keyOf: (c: PositionContribution) => string,
  tickerIndex: Map<string, number>,
  mat: number[][],
): BucketRisk[] {
  const map = new Map<string, PositionContribution[]>()
  for (const c of contribs) {
    const k = keyOf(c) || "Other"
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(c)
  }
  const buckets = [...map.entries()].map(([bucket, items]) => {
    const weightPct = items.reduce((s, c) => s + c.weightPct, 0)
    const idx = items.map(c => tickerIndex.get(c.ticker.toUpperCase())).filter((v): v is number => v != null)
    const avgCorr = idx.length >= 2 ? avgBucketCorr(idx, mat) : NaN
    const concentrated = weightPct > 30 || (weightPct > 22 && !isNaN(avgCorr) && avgCorr > 0.6)
    return { bucket, weightPct, avgCorr, count: items.length, tickers: items.map(c => c.ticker), concentrated }
  })
  return buckets.sort((a, b) => b.weightPct - a.weightPct)
}

export async function computeRiskBudget(
  positions: Position[],
  signals: Record<string, PositionRiskSignal>,
  supplyChain: SupplyChainSnapshot | null,
): Promise<RiskBudgetSnapshot> {
  const holdings = positions.filter(p => p.isActive && p.category !== "watchlist")
  const base: RiskBudgetSnapshot = {
    available: false, totalValue: 0, positions: [], sectorBuckets: [], categoryBuckets: [],
    overallCorr: NaN, aiSemiExposurePct: 0, supplyChainRegime: supplyChain?.regime ?? "—",
    effectiveBets: 0, diversificationNote: "", trimSuggestions: [], warnings: [],
  }
  if (holdings.length < 2) { base.warnings.push("ต้องมีอย่างน้อย 2 holdings"); return base }

  const values = holdings.map(p => ({ p, value: p.shares * p.currentPrice }))
  const totalValue = values.reduce((s, v) => s + v.value, 0) || 1
  const tickers = holdings.map(p => p.ticker.toUpperCase())

  // Aligned returns → volatility + correlation
  const aligned = await fetchAlignedReturns(tickers)
  const survived = aligned.tickers
  const tickerIndex = new Map(survived.map((t, i) => [t, i]))
  const mat = survived.length >= 2 ? correlationMatrix(survived, aligned.returns) : []
  const overallCorr = mat.length ? avgOverallCorr(mat) : NaN

  // Position contributions: risk ≈ weight × annualized vol
  let rawRiskTotal = 0
  const prelim = values.map(({ p, value }) => {
    const tk = p.ticker.toUpperCase()
    const rets = aligned.returns[tk] || []
    const volAnnual = stdev(rets) * Math.sqrt(252) * 100
    const weightPct = (value / totalValue) * 100
    const rawRisk = weightPct * (volAnnual || 25)  // fallback vol if no returns
    rawRiskTotal += rawRisk
    return { p, weightPct, volAnnual, rawRisk }
  })

  const equalWeight = 100 / holdings.length
  let aiSemiExposurePct = 0

  const contribs: PositionContribution[] = prelim.map(({ p, weightPct, volAnnual, rawRisk }) => {
    const tk = p.ticker.toUpperCase()
    const sig = signals[tk]
    const level = sig?.level ?? "OK"
    if (isAISemiDownstream(tk)) aiSemiExposurePct += weightPct

    const reasons: string[] = []
    let trim = false
    const overweight = weightPct > Math.max(15, equalWeight * 1.6)
    if (overweight) { reasons.push(`น้ำหนัก ${weightPct.toFixed(0)}% (เกิน equal-weight ${equalWeight.toFixed(0)}%)`) }
    if (level === "DE-RISK" || level === "CUT") { reasons.push(`de-risk ${level} (${sig?.driver})`); trim = true }
    if (volAnnual > 60) reasons.push(`ผันผวนสูง ${volAnnual.toFixed(0)}%/ปี`)
    // overweight + any weakness = trim candidate
    if (overweight && (level !== "OK" || volAnnual > 60)) trim = true

    return {
      ticker: p.ticker, sector: p.sector || "Other", category: p.category,
      weightPct, volAnnual,
      riskSharePct: (rawRisk / rawRiskTotal) * 100,
      deRiskLevel: level, driver: sig?.driver ?? "none",
      earningsInDays: sig?.earningsInDays ?? null,
      trim, reasons,
    }
  }).sort((a, b) => b.riskSharePct - a.riskSharePct)

  const sectorBuckets = buildBuckets(contribs, c => c.sector, tickerIndex, mat)
  const categoryBuckets = buildBuckets(contribs, c => c.category, tickerIndex, mat)

  // Herfindahl effective bets (weights as fractions)
  const hhi = contribs.reduce((s, c) => s + (c.weightPct / 100) ** 2, 0)
  const effectiveBets = hhi > 0 ? 1 / hhi : holdings.length

  const diversificationNote =
    effectiveBets < holdings.length * 0.5
      ? `กระจุกตัว — มี ${holdings.length} ตัว แต่เทียบเท่าแค่ ~${effectiveBets.toFixed(1)} ตัว (น้ำหนักเอียง)`
      : `กระจายพอใช้ — เทียบเท่า ~${effectiveBets.toFixed(1)} ตัวเท่าๆ กัน`

  // ── Synthesised warnings + trim suggestions ──
  const warnings: string[] = []
  const trimSuggestions: string[] = []

  for (const b of sectorBuckets) {
    if (b.concentrated) {
      warnings.push(`${b.bucket} ${b.weightPct.toFixed(0)}%${!isNaN(b.avgCorr) ? ` · corr ${b.avgCorr.toFixed(2)}` : ""} — กระจุกในเซกเตอร์เดียว`)
    }
  }
  if (!isNaN(overallCorr) && overallCorr > 0.55) {
    warnings.push(`ค่าเฉลี่ย correlation ทั้งพอร์ต ${overallCorr.toFixed(2)} สูง — กระจายจริงน้อยกว่าที่เห็น`)
  }
  if (supplyChain?.available && supplyChain.deRiskLevel > 0 && aiSemiExposurePct > 15) {
    warnings.push(`AI/semi ${aiSemiExposurePct.toFixed(0)}% ของพอร์ต และต้นน้ำ ${supplyChain.regime} — ความเสี่ยงเซกเตอร์รวม`)
  }

  const trimList = contribs.filter(c => c.trim)
  for (const c of trimList) {
    const target = Math.max(equalWeight, 8)
    trimSuggestions.push(`หั่น ${c.ticker} (${c.weightPct.toFixed(0)}% · ${c.reasons.join(" · ")}) → ลดเข้าใกล้ ~${target.toFixed(0)}%`)
  }
  if (trimSuggestions.length === 0) trimSuggestions.push("ไม่มีตัวที่ต้องหั่นด่วน — น้ำหนัก/ความเสี่ยงสมดุลพอใช้")

  return {
    available: true, totalValue, positions: contribs, sectorBuckets, categoryBuckets,
    overallCorr, aiSemiExposurePct, supplyChainRegime: supplyChain?.regime ?? "—",
    effectiveBets, diversificationNote, trimSuggestions, warnings,
  }
}
