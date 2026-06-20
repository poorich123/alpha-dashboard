"use client"

import { Workflow, TrendingUp, TrendingDown, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { Sparkline } from "@/components/market/Sparkline"
import type { SupplyChainSnapshot } from "@/lib/supplyChain"

export function SupplyChainCard({ snap }: { snap: SupplyChainSnapshot | null }) {
  if (!snap) return null
  if (!snap.available) {
    return (
      <div className="rounded-2xl border border-[#1A2E52] bg-[#0C1628] p-4 mb-4 text-sm text-gray-500">
        Supply-Chain Bellwether: ข้อมูลต้นน้ำไม่พอ (ลอง Refresh)
      </div>
    )
  }

  const accent =
    snap.regime === "HEALTHY" ? "border-emerald-500/40 bg-emerald-500/5" :
    snap.regime === "COOLING" ? "border-yellow-500/40 bg-yellow-500/5" :
    snap.regime === "DETERIORATING" ? "border-orange-500/40 bg-orange-500/5" :
    "border-red-500/40 bg-red-500/5"

  return (
    <div className="rounded-2xl border border-[#1A2E52] bg-[#0C1628] p-4 mb-4 hsr-card">
      <div className="flex items-center gap-2 mb-3">
        <Workflow className="w-4 h-4 text-teal-400" />
        <div>
          <div className="text-sm font-bold text-white">Supply-Chain Bellwether · De-risk</div>
          <div className="text-[10px] text-gray-500">
            ต้นน้ำ AI/semi (ASML · TSM · AMAT/LRCX/KLAC · AVGO · NVDA) — หักหัวลง = สั่ง de-risk หุ้นปลายน้ำ
          </div>
        </div>
      </div>

      {/* Overall regime */}
      <div className={cn("rounded-xl border p-3 mb-3 flex items-start gap-3 flex-wrap", accent)}>
        <div className="text-center">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">Health</div>
          <div className={cn("text-3xl font-bold font-mono", snap.color)}>{snap.score}</div>
          <div className="text-[10px] text-gray-600">/100</div>
        </div>
        <div className="flex-1 min-w-[180px]">
          <div className={cn("text-sm font-bold", snap.color)}>{snap.regime}</div>
          <div className="text-[11px] text-gray-300 mt-0.5">{snap.headline}</div>
          <div className="flex items-start gap-1.5 mt-1.5 text-[11px] text-gray-400">
            <Zap className="w-3 h-3 text-cyan-400 mt-0.5 flex-shrink-0" />
            <span>{snap.guidance}</span>
          </div>
          {snap.deRiskLevel > 0 && (
            <div className="text-[10px] text-orange-300 mt-1">
              De-risk level {(snap.deRiskLevel * 100).toFixed(0)}% — stop หุ้น AI/semi ปลายน้ำจะถูกกระชับ + ลดไม้
            </div>
          )}
        </div>
      </div>

      {/* Bellwether grid (weakest first) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {snap.bellwethers.map(b => (
          <div key={b.ticker} className="bg-[#070B18] border border-[#1A2E52]/60 rounded-lg p-2.5">
            <div className="flex items-center justify-between mb-1">
              <div className="min-w-0">
                <span className="text-sm font-bold text-white font-mono">{b.ticker}</span>
                <span className="text-[9px] text-gray-600 ml-1.5">{b.role}</span>
              </div>
              <span className={cn("text-xs font-mono font-bold",
                b.score >= 70 ? "text-emerald-400" : b.score >= 55 ? "text-yellow-400" : b.score >= 40 ? "text-orange-400" : "text-red-400")}>
                {b.score}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkline data={b.trend30d} width={70} height={22} />
              <div className="text-[9px] font-mono leading-tight">
                <div className={b.mom20 >= 0 ? "text-emerald-400" : "text-red-400"}>
                  20d {b.mom20 >= 0 ? "+" : ""}{b.mom20.toFixed(0)}%
                </div>
                <div className={b.mom60 >= 0 ? "text-gray-400" : "text-red-400"}>
                  60d {b.mom60 >= 0 ? "+" : ""}{b.mom60.toFixed(0)}%
                </div>
              </div>
              <div className="ml-auto flex flex-col gap-0.5 items-end">
                <span className={cn("text-[8px] flex items-center gap-0.5", b.aboveEma50 ? "text-emerald-400" : "text-red-400")}>
                  {b.aboveEma50 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />} EMA50
                </span>
                <span className={cn("text-[8px]", b.aboveEma200 ? "text-emerald-400/70" : "text-red-400/70")}>
                  {b.aboveEma200 ? "▲" : "▼"} EMA200
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
