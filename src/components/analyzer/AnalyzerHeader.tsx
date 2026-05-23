"use client"

import type { AnalyzerResult } from "@/lib/stockAnalyzer"
import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown } from "lucide-react"

interface Props {
  result: AnalyzerResult
}

function signalColor(signal: AnalyzerResult["signal"]) {
  switch (signal) {
    case "STRONG BUY":  return "text-emerald-400"
    case "BUY":         return "text-green-400"
    case "HOLD":        return "text-yellow-400"
    case "SELL":        return "text-orange-400"
    case "STRONG SELL": return "text-red-400"
  }
}

function confidenceColor(c: AnalyzerResult["confidence"]) {
  if (c === "HIGH") return "text-emerald-400"
  if (c === "MEDIUM") return "text-yellow-400"
  return "text-red-400"
}

export function AnalyzerHeader({ result }: Props) {
  const { ticker, companyName, sector, industry, logo, signal, score, scoreMax, scoreNA, scorePct, confidence, snapshot, tradeLevels } = result
  const sigColor = signalColor(signal)
  const confColor = confidenceColor(confidence)
  const naLabel = scoreNA > 0 ? ` · ${scoreNA} N/A` : ""

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 mb-4">
      {/* ── Left: Ticker card ────────────────────────────────────── */}
      <div className="bg-[#0C1628] border border-[#1A2E52] rounded-2xl p-5 hsr-card flex flex-col justify-between">
        <div className="flex items-start gap-3 mb-3">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="w-14 h-14 rounded-lg bg-white/5 p-1" onError={(e) => (e.currentTarget.style.display = "none")} />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-[#1A2E52] flex items-center justify-center text-xl font-bold text-cyan-400">
              {ticker[0]}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-2xl font-bold text-white truncate">{ticker}</div>
            <div className="text-xs text-gray-500 truncate">{companyName}</div>
            <div className="text-[10px] text-gray-600 mt-0.5 truncate">{sector} · {industry}</div>
          </div>
        </div>

        {/* Current price */}
        <div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-3xl font-bold text-white">${snapshot.currentPrice.toFixed(2)}</span>
            <span className={cn("text-sm font-semibold flex items-center gap-0.5",
              snapshot.changePct >= 0 ? "text-emerald-400" : "text-red-400"
            )}>
              {snapshot.changePct >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {snapshot.changePct >= 0 ? "+" : ""}{snapshot.changePct.toFixed(2)}%
            </span>
          </div>
          <div className="text-xs text-gray-500">
            Today · ${snapshot.dayLow.toFixed(2)} – ${snapshot.dayHigh.toFixed(2)}
          </div>
        </div>

        {/* Quick badges */}
        <div className="flex gap-1.5 mt-3 flex-wrap">
          <span className="text-[10px] bg-[#1A2E52]/70 text-gray-400 px-2 py-0.5 rounded-full border border-[#1A2E52]">
            {snapshot.exchange}
          </span>
          <span className="text-[10px] bg-[#1A2E52]/70 text-gray-400 px-2 py-0.5 rounded-full border border-[#1A2E52]">
            MCap {snapshot.marketCap}
          </span>
        </div>
      </div>

      {/* ── Right: Score/TP/SL panel ───────────────────────────── */}
      <div className="bg-[#0C1628] border border-[#1A2E52] rounded-2xl overflow-hidden hsr-card">
        <div className="text-center text-xs text-gray-500 tracking-widest uppercase pt-2 pb-1 border-b border-[#1A2E52] bg-[#070B18]">
          OVERVIEW
        </div>

        {/* Top: 4 metrics */}
        <div className="grid grid-cols-4 border-b border-[#1A2E52]">
          <Metric label="Signal" value={signal} color={sigColor} large />
          <Metric label="Score" value={`${score}/${scoreMax}`} subLabel={naLabel || undefined} color={sigColor} large />
          <Metric label="Alpha Score" value={`${scorePct}%`} color={scorePct >= 75 ? "text-emerald-400" : scorePct >= 50 ? "text-yellow-400" : "text-red-400"} large />
          <Metric label="Confidence" value={confidence} color={confColor} large />
        </div>

        {/* Subtitle */}
        <div className="text-center text-xs text-gray-500 py-1.5 border-b border-[#1A2E52] bg-[#070B18]/50">
          สำหรับเก็งกำไร (ระยะสั้น · อัปเดตรายสัปดาห์ · ทุกวันอาทิตย์)
        </div>

        {/* Trade levels grid */}
        <div className="grid grid-cols-3 md:grid-cols-6">
          <LevelCell label="TP1"        value={`$${tradeLevels.tp1.toFixed(2)}`}              sub={`+${tradeLevels.tp1Pct.toFixed(1)}%`} color="text-emerald-400" />
          <LevelCell label="TP2"        value={`$${tradeLevels.tp2.toFixed(2)}`}              sub={`+${tradeLevels.tp2Pct.toFixed(1)}%`} color="text-emerald-400" />
          <LevelCell label="TP3"        value={`$${tradeLevels.tp3.toFixed(2)}`}              sub={`+${tradeLevels.tp3Pct.toFixed(1)}%`} color="text-emerald-400" />
          <LevelCell label="โซนสะสม"     value={`$${tradeLevels.tradeAccumHigh.toFixed(2)}`}   sub={`$${tradeLevels.tradeAccumLow.toFixed(2)}`} color="text-pink-400" />
          <LevelCell label="SL"         value={`$${tradeLevels.sl.toFixed(2)}`}               sub={`${tradeLevels.slPct.toFixed(1)}%`} color="text-red-400" />
          <LevelCell label="R/R"        value={`${tradeLevels.riskReward.toFixed(2)}×`}       sub={tradeLevels.riskReward >= 2 ? "Favorable" : "Tight"} color={tradeLevels.riskReward >= 2 ? "text-emerald-400" : "text-orange-400"} />
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value, subLabel, color, large = false }: { label: string; value: string; subLabel?: string; color: string; large?: boolean }) {
  return (
    <div className="text-center py-3 border-r border-[#1A2E52] last:border-0">
      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">{label}</div>
      <div className={cn("font-bold", large ? "text-base lg:text-lg" : "text-sm", color)}>{value}</div>
      {subLabel && <div className="text-[9px] text-gray-600 mt-0.5">{subLabel}</div>}
    </div>
  )
}

function LevelCell({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="text-center py-2.5 border-r border-t border-[#1A2E52] last:border-r-0">
      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">{label}</div>
      <div className={cn("font-bold text-sm", color)}>{value}</div>
      <div className="text-[10px] text-gray-600 mt-0.5">{sub}</div>
    </div>
  )
}
