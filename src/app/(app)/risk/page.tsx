"use client"

import { useState, useEffect, useCallback } from "react"
import { Gauge, RefreshCw, AlertTriangle, Scissors, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { HSRHeroBanner } from "@/components/hsr/HSRHeroBanner"
import { PAGE_CHARACTERS } from "@/components/hsr/characters"
import { InlineSpinner } from "@/components/ui/LoadingSpinner"
import { usePortfolioStore } from "@/store/portfolioStore"
import { useAlertStore } from "@/store/alertStore"
import { detectSupplyChainHealth } from "@/lib/supplyChain"
import { computeRiskBudget, type RiskBudgetSnapshot, type BucketRisk } from "@/lib/riskBudget"
import { cn } from "@/lib/utils"

export default function RiskBudgetPage() {
  const character = PAGE_CHARACTERS.analytics  // Black Swan — risk lens
  const { positions } = usePortfolioStore()
  const positionRiskSignals = useAlertStore(s => s.positionRiskSignals)
  const [snap, setSnap] = useState<RiskBudgetSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [dim, setDim] = useState<"sector" | "category">("sector")

  const run = useCallback(async () => {
    setLoading(true)
    try {
      const sc = await detectSupplyChainHealth().catch(() => null)
      const result = await computeRiskBudget(positions, positionRiskSignals, sc)
      setSnap(result)
    } finally { setLoading(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions.length])

  useEffect(() => { run() }, [run])

  const buckets = snap ? (dim === "sector" ? snap.sectorBuckets : snap.categoryBuckets) : []

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto">
      <HSRHeroBanner character={character} title="Risk Budget" height="h-40">
        <div className="text-[10px] tracking-[0.2em] uppercase font-semibold mb-1" style={{ color: character.color }}>
          Portfolio Risk · Where to Trim
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">Risk Budget</h1>
        <div className="text-xs text-gray-400">
          รวม น้ำหนัก × ผันผวน × correlation × de-risk × supply-chain — ความเสี่ยงกระจุกตรงไหน ควรหั่นอะไร
        </div>
      </HSRHeroBanner>

      <div className="flex justify-end mb-3">
        <Button size="sm" variant="outline" onClick={run} disabled={loading}
          className="border-[#1F3566] text-gray-300 gap-1 h-8 text-xs">
          <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} /> Recompute
        </Button>
      </div>

      {loading && !snap ? (
        <div className="flex items-center justify-center py-16">
          <InlineSpinner className="text-cyan-400 w-5 h-5" />
          <span className="ml-2 text-gray-500 text-sm">รวมข้อมูลความเสี่ยง…</span>
        </div>
      ) : !snap?.available ? (
        <div className="py-16 text-center text-gray-500 text-sm">
          {snap?.warnings[0] || "ต้องมีอย่างน้อย 2 holdings"}
        </div>
      ) : (
        <div className="space-y-5">
          {/* Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryCard label="Effective bets" value={snap.effectiveBets.toFixed(1)}
              sub={`จาก ${snap.positions.length} ตัว`} tone="neutral" />
            <SummaryCard label="Avg correlation" value={isNaN(snap.overallCorr) ? "—" : snap.overallCorr.toFixed(2)}
              sub={snap.overallCorr > 0.55 ? "สูง — กระจายน้อย" : "ปกติ"} tone={snap.overallCorr > 0.55 ? "warn" : "good"} />
            <SummaryCard label="AI/semi exposure" value={`${snap.aiSemiExposurePct.toFixed(0)}%`}
              sub={`ต้นน้ำ ${snap.supplyChainRegime}`} tone={snap.aiSemiExposurePct > 30 ? "warn" : "neutral"} />
            <SummaryCard label="Trim candidates" value={String(snap.positions.filter(p => p.trim).length)}
              sub="ตัวที่ควรหั่น" tone={snap.positions.some(p => p.trim) ? "warn" : "good"} />
          </div>

          <div className="text-[11px] text-gray-400 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 text-cyan-400 mt-0.5 flex-shrink-0" />
            <span>{snap.diversificationNote}</span>
          </div>

          {/* Warnings */}
          {snap.warnings.length > 0 && (
            <div className="bg-orange-500/5 border border-orange-500/30 rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-orange-300 mb-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> ความเสี่ยงกระจุกตัว
              </div>
              <ul className="space-y-1">
                {snap.warnings.map((w, i) => <li key={i} className="text-[11px] text-gray-300">· {w}</li>)}
              </ul>
            </div>
          )}

          {/* Trim suggestions */}
          <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-4 hsr-card">
            <div className="flex items-center gap-1.5 text-sm font-bold text-white mb-2">
              <Scissors className="w-4 h-4 text-red-400" /> คำแนะนำหั่นความเสี่ยง (เรียงตามความสำคัญ)
            </div>
            <ul className="space-y-1.5">
              {snap.trimSuggestions.map((s, i) => (
                <li key={i} className="text-[12px] text-gray-300 flex items-start gap-2">
                  <span className="text-red-400 font-bold flex-shrink-0">{i + 1}.</span><span>{s}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Concentration by bucket */}
          <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="text-sm font-bold text-white">การกระจุกตัว × correlation</div>
              <div className="flex rounded-lg border border-[#1F3566] overflow-hidden">
                {(["sector", "category"] as const).map(d => (
                  <button key={d} onClick={() => setDim(d)}
                    className={cn("px-2.5 py-1 text-xs font-medium", dim === d ? "bg-cyan-500/15 text-cyan-300" : "text-gray-400 hover:bg-[#1A2E52]/40")}>
                    {d === "sector" ? "Sector" : "Category"}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              {buckets.map(b => <BucketBar key={b.bucket} b={b} />)}
            </div>
          </div>

          {/* Risk contributors */}
          <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[#1A2E52] text-sm font-bold text-white">
              ตัวที่กินงบความเสี่ยงมากสุด (น้ำหนัก × ผันผวน)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[560px]">
                <thead className="bg-[#070B18]/60 text-[10px] text-gray-500 uppercase">
                  <tr>
                    <th className="text-left px-3 py-2">Ticker</th>
                    <th className="text-right px-3 py-2">Weight</th>
                    <th className="text-right px-3 py-2">Vol/ปี</th>
                    <th className="text-right px-3 py-2">Risk share</th>
                    <th className="text-center px-3 py-2">De-risk</th>
                    <th className="text-center px-3 py-2">งบ</th>
                  </tr>
                </thead>
                <tbody>
                  {snap.positions.map(c => (
                    <tr key={c.ticker} className={cn("border-t border-[#1A2E52]/40", c.trim && "bg-red-500/[0.05]")}>
                      <td className="px-3 py-2">
                        <span className="text-white font-mono font-medium">{c.ticker}</span>
                        <span className="text-[9px] text-gray-600 ml-1.5">{c.sector}</span>
                        {c.trim && <span className="ml-1.5 text-[8px] text-red-300 bg-red-500/15 border border-red-500/40 rounded px-1 py-0.5">หั่น</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-300">{c.weightPct.toFixed(1)}%</td>
                      <td className={cn("px-3 py-2 text-right font-mono", c.volAnnual > 60 ? "text-orange-400" : "text-gray-400")}>
                        {c.volAnnual > 0 ? `${c.volAnnual.toFixed(0)}%` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="w-14 h-1.5 bg-[#1A2E52] rounded-full overflow-hidden">
                            <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${Math.min(100, c.riskSharePct * 2)}%` }} />
                          </div>
                          <span className="font-mono text-cyan-300 w-9 text-right">{c.riskSharePct.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {c.deRiskLevel === "OK" ? <span className="text-gray-600 text-[10px]">—</span> : (
                          <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border",
                            c.deRiskLevel === "CUT" ? "text-red-300 bg-red-500/15 border-red-500/40" :
                            c.deRiskLevel === "DE-RISK" ? "text-orange-300 bg-orange-500/10 border-orange-500/30" :
                            "text-yellow-300 bg-yellow-500/10 border-yellow-500/30")}>
                            {c.deRiskLevel}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center text-[10px]">
                        {c.earningsInDays != null && c.earningsInDays <= 7
                          ? <span className={c.earningsInDays <= 2 ? "text-red-400" : "text-orange-400"}>📅 {c.earningsInDays}d</span>
                          : <span className="text-gray-700">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-[10px] text-gray-600">
            Risk share ≈ น้ำหนัก × ความผันผวน (realized 6 เดือน) · ไม่ใช่คำแนะนำลงทุน · de-risk/earnings มาจากรอบสแกนล่าสุด
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: "good" | "warn" | "neutral" }) {
  const color = tone === "warn" ? "text-orange-400" : tone === "good" ? "text-emerald-400" : "text-white"
  return (
    <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-3">
      <div className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</div>
      <div className={cn("text-2xl font-bold font-mono", color)}>{value}</div>
      <div className="text-[10px] text-gray-600 mt-0.5">{sub}</div>
    </div>
  )
}

function BucketBar({ b }: { b: BucketRisk }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-0.5">
        <span className="text-gray-300 flex items-center gap-1.5">
          {b.bucket} <span className="text-gray-600">({b.count})</span>
          {b.concentrated && <span className="text-[8px] text-orange-300 bg-orange-500/15 border border-orange-500/40 rounded px-1">กระจุก</span>}
        </span>
        <span className="font-mono text-gray-400">
          {b.weightPct.toFixed(0)}%
          {!isNaN(b.avgCorr) && <span className={cn("ml-2", b.avgCorr > 0.6 ? "text-orange-400" : "text-gray-500")}>corr {b.avgCorr.toFixed(2)}</span>}
        </span>
      </div>
      <div className="h-2 bg-[#1A2E52] rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", b.concentrated ? "bg-orange-500" : "bg-cyan-500")}
          style={{ width: `${Math.min(100, b.weightPct)}%` }} />
      </div>
    </div>
  )
}
