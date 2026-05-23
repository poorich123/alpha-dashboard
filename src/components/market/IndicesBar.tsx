"use client"

import { Sparkline } from "./Sparkline"
import { cn } from "@/lib/utils"
import type { IndexQuote } from "@/lib/marketOverview"

interface Props {
  indices: IndexQuote[]
  loading?: boolean
}

export function IndicesBar({ indices, loading }: Props) {
  if (loading && indices.length === 0) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
        {Array(6).fill(0).map((_, i) => (
          <div key={i} className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-3 h-24 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
      {indices.map((idx) => (
        <IndexCard key={idx.symbol} idx={idx} />
      ))}
    </div>
  )
}

function IndexCard({ idx }: { idx: IndexQuote }) {
  const isUp = idx.changePct >= 0
  return (
    <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-3 hsr-card relative overflow-hidden">
      {/* Label */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <div className="text-xs font-bold text-white">{idx.label}</div>
          <div className="text-[9px] text-gray-600 truncate">{idx.description}</div>
        </div>
      </div>

      {/* Price + Change */}
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-base font-bold text-white font-mono">
          {idx.price >= 1000 ? idx.price.toFixed(0) : idx.price.toFixed(2)}
        </span>
        <span className={cn("text-[10px] font-bold font-mono", isUp ? "text-emerald-400" : "text-red-400")}>
          {isUp ? "▲" : "▼"} {Math.abs(idx.changePct).toFixed(2)}%
        </span>
      </div>

      {/* Sparkline */}
      <div className="opacity-80">
        <Sparkline data={idx.sparkline} width={150} height={28} />
      </div>
    </div>
  )
}
