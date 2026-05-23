"use client"

import { useState } from "react"
import { AlertTriangle, Sparkles, Target, TrendingDown, ChevronDown, ChevronUp } from "lucide-react"
import type { EntryRecommendation, TradeLevels } from "@/lib/stockAnalyzer"
import { cn } from "@/lib/utils"

interface Props {
  rec: EntryRecommendation
  levels: TradeLevels
  ticker: string
}

function tierBg(strategy: EntryRecommendation["strategy"]) {
  switch (strategy) {
    case "ALL_IN":        return "border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5"
    case "SPLIT_50":      return "border-yellow-500/40 bg-gradient-to-br from-yellow-500/10 to-yellow-500/5"
    case "PARTIAL_30":    return "border-orange-500/40 bg-gradient-to-br from-orange-500/10 to-orange-500/5"
    case "WAIT_PULLBACK": return "border-red-500/40 bg-gradient-to-br from-red-500/10 to-red-500/5"
    case "SKIP":          return "border-gray-700 bg-gray-800/30"
  }
}

function tierBarColor(strategy: EntryRecommendation["strategy"]) {
  switch (strategy) {
    case "ALL_IN":        return "bg-emerald-500"
    case "SPLIT_50":      return "bg-yellow-500"
    case "PARTIAL_30":    return "bg-orange-500"
    case "WAIT_PULLBACK": return "bg-red-500"
    case "SKIP":          return "bg-gray-600"
  }
}

export function EntryStrategyCard({ rec, levels, ticker }: Props) {
  const [open, setOpen] = useState(true)

  // Visual position bar — accum zone, current price, BB upper
  const accumLow  = levels.tradeAccumLow
  const accumHigh = levels.tradeAccumHigh
  const current   = levels.currentPrice
  const tp1       = levels.tp1
  const sl        = levels.sl

  // Build coords (0-100% of bar)
  const min = Math.min(sl, accumLow) * 0.98
  const max = Math.max(tp1, current) * 1.02
  const pos = (p: number) => Math.max(0, Math.min(100, ((p - min) / (max - min)) * 100))

  return (
    <div className={cn("rounded-2xl border-2 p-5 hsr-card mb-4 transition-all", tierBg(rec.strategy))}>
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between mb-2"
      >
        <div className="flex items-center gap-3 text-left">
          <div className="text-3xl">{rec.emoji}</div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">
              Entry Strategy · Real-Time
            </div>
            <div className={cn("text-xl lg:text-2xl font-bold", rec.color)}>
              {rec.label}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Size pill */}
          {rec.sizeNow > 0 && (
            <div className="text-right">
              <div className="text-[10px] text-gray-500">เข้าตอนนี้</div>
              <div className={cn("text-xl font-bold", rec.color)}>{rec.sizeNow}%</div>
            </div>
          )}
          {rec.sizeOnPullback > 0 && (
            <div className="text-right">
              <div className="text-[10px] text-gray-500">รอ pullback</div>
              <div className="text-xl font-bold text-cyan-400">{rec.sizeOnPullback}%</div>
            </div>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </div>
      </button>

      {open && (
        <>
          {/* Reasoning */}
          <p className="text-sm text-gray-300 leading-relaxed mb-3 mt-2">
            {rec.reasoning}
          </p>

          {/* Visual position bar */}
          {rec.strategy !== "SKIP" && (
            <div className="mb-4">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Price Position</div>
              <div className="relative h-9">
                {/* Track */}
                <div className="absolute inset-y-4 left-0 right-0 bg-[#1A2E52] rounded-full h-1" />

                {/* Accum zone (green band) */}
                <div
                  className="absolute h-1 top-4 bg-emerald-500/40 rounded"
                  style={{ left: `${pos(accumLow)}%`, width: `${pos(accumHigh) - pos(accumLow)}%` }}
                />

                {/* SL marker */}
                <div className="absolute top-0 bottom-0 flex flex-col items-center" style={{ left: `${pos(sl)}%`, transform: "translateX(-50%)" }}>
                  <div className="w-0.5 h-full bg-red-500 rounded" />
                  <div className="absolute -bottom-4 text-[9px] text-red-400 whitespace-nowrap">SL ${sl.toFixed(2)}</div>
                </div>

                {/* Accum low label */}
                <div className="absolute -top-3 text-[9px] text-emerald-400" style={{ left: `${pos(accumLow)}%`, transform: "translateX(-50%)" }}>
                  Accum ${accumLow.toFixed(2)}
                </div>
                <div className="absolute -top-3 text-[9px] text-emerald-400" style={{ left: `${pos(accumHigh)}%`, transform: "translateX(-50%)" }}>
                  ${accumHigh.toFixed(2)}
                </div>

                {/* Current price marker (white, big) */}
                <div className="absolute top-0 bottom-0 flex flex-col items-center" style={{ left: `${pos(current)}%`, transform: "translateX(-50%)" }}>
                  <div className={cn("w-1 h-full rounded", tierBarColor(rec.strategy))} />
                  <div className="absolute -bottom-4 text-[10px] font-bold text-white whitespace-nowrap">
                    Now ${current.toFixed(2)}
                  </div>
                </div>

                {/* TP1 marker */}
                <div className="absolute top-0 bottom-0 flex flex-col items-center" style={{ left: `${pos(tp1)}%`, transform: "translateX(-50%)" }}>
                  <div className="w-0.5 h-full bg-emerald-400 rounded" />
                  <div className="absolute -bottom-4 text-[9px] text-emerald-400 whitespace-nowrap">TP1 ${tp1.toFixed(2)}</div>
                </div>
              </div>
              <div className="mt-7 flex items-center justify-between text-[10px] text-gray-600">
                <span>%B = {rec.pctB.toFixed(2)} {rec.pctB > 1 ? "(overextended)" : rec.pctB > 0.8 ? "(upper zone)" : "(ok)"}</span>
                <span>
                  {rec.distFromAccum >= 0 ? "+" : ""}{rec.distFromAccum.toFixed(1)}% from accum top
                  <span className="text-gray-700"> · ${accumHigh.toFixed(2)}</span>
                </span>
              </div>
            </div>
          )}

          {/* Action Plan */}
          {rec.strategy !== "SKIP" && (
            <div className="bg-[#070B18]/60 border border-[#1A2E52]/70 rounded-xl p-3 mb-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Target className="w-3 h-3" />Action Plan
              </div>
              <div className="space-y-1.5 text-xs">
                {rec.sizeNow > 0 && rec.entryPriceNow && (
                  <div className="flex items-center gap-2">
                    <span className={cn("inline-block w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold", tierBarColor(rec.strategy), "text-white")}>
                      1
                    </span>
                    <span className="text-gray-300">
                      เข้า <span className={cn("font-bold", rec.color)}>{rec.sizeNow}%</span> ตอนนี้ที่ <span className="text-white font-mono">${rec.entryPriceNow.toFixed(2)}</span>
                    </span>
                  </div>
                )}
                {rec.sizeOnPullback > 0 && rec.pullbackTarget && (
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center text-[10px] font-bold text-white">
                      {rec.sizeNow > 0 ? "2" : "1"}
                    </span>
                    <span className="text-gray-300">
                      รอ <span className="font-bold text-cyan-400">{rec.sizeOnPullback}%</span> ที่ <span className="text-white font-mono">${rec.pullbackTarget.toFixed(2)}</span>
                      {rec.pullbackPct !== undefined && (
                        <span className="text-gray-500"> ({rec.pullbackPct >= 0 ? "+" : ""}{rec.pullbackPct.toFixed(1)}%)</span>
                      )}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 pt-1 border-t border-[#1A2E52]/50">
                  <span className="inline-block w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-[10px] font-bold text-white">
                    SL
                  </span>
                  <span className="text-gray-300">
                    Stop loss ที่ <span className="text-red-400 font-mono">${sl.toFixed(2)}</span>
                    <span className="text-gray-500"> ({levels.slPct.toFixed(1)}%)</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] font-bold text-white">
                    TP
                  </span>
                  <span className="text-gray-300">
                    TP1 <span className="font-mono text-emerald-400">${tp1.toFixed(2)}</span> (40%) ·
                    TP2 <span className="font-mono text-emerald-400">${levels.tp2.toFixed(2)}</span> (40%) ·
                    TP3 <span className="font-mono text-emerald-400">${levels.tp3.toFixed(2)}</span> (20%)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Warnings */}
          {rec.warnings.length > 0 && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-2.5 mb-2">
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-red-400 mb-1 font-semibold">
                <AlertTriangle className="w-3 h-3" />Warnings ({rec.warnings.length})
              </div>
              <ul className="text-xs text-gray-400 space-y-0.5">
                {rec.warnings.map((w, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-red-500 mt-0.5">▸</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Upgrades */}
          {rec.upgrades.length > 0 && (
            <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-lg p-2.5">
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-cyan-400 mb-1 font-semibold">
                <Sparkles className="w-3 h-3" />Premium Signals
              </div>
              <ul className="text-xs text-gray-400 space-y-0.5">
                {rec.upgrades.map((u, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-cyan-500 mt-0.5">▸</span>
                    <span>{u}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
