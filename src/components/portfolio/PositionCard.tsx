"use client"

import { useState } from "react"
import { Edit2, Trash2, ChevronDown, ChevronUp, Target, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PercentBadge } from "@/components/ui/PriceChange"
import { usePortfolioStore } from "@/store/portfolioStore"
import { useAlertStore } from "@/store/alertStore"
import type { Position } from "@/types"
import type { DeRiskLevel } from "@/lib/positionRisk"
import { cn } from "@/lib/utils"
import { calculatePnL } from "@/lib/portfolio"
import { differenceInDays, parseISO } from "date-fns"
import toast from "react-hot-toast"

interface Props {
  position: Position
  onEdit: (position: Position) => void
  totalPortfolioValue: number
}

export function PositionCard({ position: p, onEdit, totalPortfolioValue }: Props) {
  const { deletePosition } = usePortfolioStore()
  const [expanded, setExpanded] = useState(false)
  const riskSignal = useAlertStore(s => s.positionRiskSignals[p.ticker.toUpperCase()])

  const { unrealizedPnL, unrealizedPnLPercent, totalValue } = calculatePnL(p)
  const weight = totalPortfolioValue > 0 ? (totalValue / totalPortfolioValue) * 100 : 0
  const holdingDays = differenceInDays(new Date(), parseISO(p.entryDate))
  const targetPct = p.targetPrice > 0 ? ((p.targetPrice - p.currentPrice) / p.currentPrice) * 100 : 0
  const slPct = p.stopLoss > 0 ? ((p.currentPrice - p.stopLoss) / p.currentPrice) * 100 : 0

  // Progress bar (cost → current → target)
  const progressMin = Math.min(p.avgCost, p.stopLoss > 0 ? p.stopLoss : p.avgCost * 0.85)
  const progressMax = Math.max(p.targetPrice > 0 ? p.targetPrice : p.currentPrice * 1.3, p.currentPrice)
  const costPct = ((p.avgCost - progressMin) / (progressMax - progressMin)) * 100
  const currentPct = ((p.currentPrice - progressMin) / (progressMax - progressMin)) * 100
  const targetPctBar = p.targetPrice > 0 ? ((p.targetPrice - progressMin) / (progressMax - progressMin)) * 100 : 100

  function handleDelete() {
    if (confirm(`Delete ${p.ticker}? This cannot be undone.`)) {
      deletePosition(p.id)
      toast.success(`${p.ticker} removed`)
    }
  }

  const pnlColor = unrealizedPnL >= 0 ? "text-green-400" : "text-red-400"
  const pnlBg = unrealizedPnL >= 0 ? "bg-green-500/10" : "bg-red-500/10"

  return (
    <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl overflow-hidden card-hover">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {p.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.logoUrl}
                alt={p.ticker}
                className="w-10 h-10 rounded-lg bg-[#1A2E52] object-contain p-1"
                onError={(e) => { e.currentTarget.style.display = "none" }}
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-[#00C2D4]/20 flex items-center justify-center text-[#00D8EE] font-bold text-xs">
                {p.ticker.slice(0, 3)}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-white font-bold">{p.ticker}</span>
                <PercentBadge value={unrealizedPnLPercent} />
                {riskSignal && riskSignal.level !== "OK" && <DeRiskBadge signal={riskSignal} />}
                {riskSignal?.earningsInDays != null && riskSignal.earningsInDays <= 7 && (
                  <EarningsBadge days={riskSignal.earningsInDays} />
                )}
                {/* Show strategy badge ONLY when user explicitly set it — keeps cards clean */}
                {p.strategy && <StrategyBadge strategy={p.strategy} />}
              </div>
              <div className="text-xs text-gray-500">{p.companyName} • {p.sector}</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onEdit(p)}
              className="w-7 h-7 p-0 text-gray-400 hover:text-white"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDelete}
              className="w-7 h-7 p-0 text-gray-400 hover:text-red-400"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Price Row */}
        <div className="flex items-center justify-between mt-3">
          <div>
            <div className="text-lg font-bold text-white">${p.currentPrice.toFixed(2)}</div>
            <div className="text-xs text-gray-500">Avg cost: ${p.avgCost.toFixed(2)}</div>
          </div>
          <div className={`text-right px-3 py-1.5 rounded-lg ${pnlBg}`}>
            <div className={`text-sm font-bold ${pnlColor}`}>
              {unrealizedPnL >= 0 ? "+" : ""}${Math.abs(unrealizedPnL).toFixed(2)}
            </div>
            <div className={`text-xs ${pnlColor}`}>
              {unrealizedPnLPercent >= 0 ? "+" : ""}{unrealizedPnLPercent.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
          <div className="bg-[#1A2E52] rounded p-2">
            <div className="text-gray-500">Shares</div>
            <div className="text-white font-medium">
              {Number.isInteger(p.shares) ? p.shares : p.shares.toFixed(4)}
            </div>
          </div>
          <div className="bg-[#1A2E52] rounded p-2">
            <div className="text-gray-500">Total Value</div>
            <div className="text-white font-medium">${totalValue.toFixed(0)}</div>
          </div>
          <div className="bg-[#1A2E52] rounded p-2">
            <div className="text-gray-500">Weight</div>
            <div className="text-white font-medium">{weight.toFixed(1)}%</div>
          </div>
        </div>

        {/* Progress Bar */}
        {p.targetPrice > 0 && (
          <div className="mt-3">
            <div className="relative h-2 bg-[#1A2E52] rounded-full overflow-hidden">
              {/* Progress fill */}
              <div
                className={`absolute h-full rounded-full ${unrealizedPnL >= 0 ? "bg-green-500" : "bg-red-500"}`}
                style={{ left: `${costPct}%`, width: `${Math.max(0, currentPct - costPct)}%` }}
              />
              {/* Cost marker */}
              <div
                className="absolute w-0.5 h-full bg-gray-400"
                style={{ left: `${costPct}%` }}
              />
              {/* Target marker */}
              <div
                className="absolute w-0.5 h-full bg-yellow-400"
                style={{ left: `${Math.min(targetPctBar, 98)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-600 mt-0.5">
              <span>SL ${p.stopLoss > 0 ? p.stopLoss.toFixed(0) : "—"}</span>
              <span>Target ${p.targetPrice.toFixed(0)} (+{targetPct.toFixed(0)}%)</span>
            </div>
          </div>
        )}

        {/* Target/SL badges */}
        <div className="flex items-center gap-2 mt-2">
          {p.targetPrice > 0 && (
            <div className="flex items-center gap-1 text-xs bg-green-500/10 text-green-400 rounded px-2 py-0.5">
              <Target className="w-3 h-3" /> +{targetPct.toFixed(0)}% to target
            </div>
          )}
          {p.stopLoss > 0 && (
            <div className="flex items-center gap-1 text-xs bg-red-500/10 text-red-400 rounded px-2 py-0.5">
              <Shield className="w-3 h-3" /> -{slPct.toFixed(0)}% to SL
            </div>
          )}
          <div className="ml-auto text-xs text-gray-500">{holdingDays}d held</div>
        </div>
      </div>

      {/* Thesis (collapsible) */}
      {p.thesis && (
        <div className="border-t border-[#1A2E52]">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between px-4 py-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            <span>Investment Thesis</span>
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {expanded && (
            <div className="px-4 pb-3">
              <p className="text-xs text-gray-400 leading-relaxed">{p.thesis}</p>
              {p.notes && (
                <p className="text-xs text-gray-500 mt-2 italic">{p.notes}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Strategy badge ───────────────────────────────────────────────────────────
//
// Compact pill showing how this position is managed:
//   DCA   → long-term, accumulate at Fibonacci retracements
//   SWING → short-term, trade Pivot Point S/R
//   SPEC  → high-risk momentum, no fixed levels
//
function DeRiskBadge({ signal }: {
  signal: {
    level: DeRiskLevel; driver: string; summary: string
    technicalScore: number; thesisScore: number
    technicalReasons: string[]; thesisReasons: string[]; suggestedAction: string
  }
}) {
  const cfg =
    signal.level === "CUT"     ? { label: "CUT",     color: "text-red-300 bg-red-500/20 border-red-500/50 critical-pulse" } :
    signal.level === "DE-RISK" ? { label: "DE-RISK", color: "text-orange-300 bg-orange-500/15 border-orange-500/40" } :
                                 { label: "WATCH",   color: "text-yellow-300 bg-yellow-500/10 border-yellow-500/30" }
  // Driver hint: thesis = real concern, technical = chart-only (likely rotation)
  const driverTag = signal.driver === "thesis" ? "ไส้ใน" : signal.driver === "both" ? "ราคา+ไส้ใน" : signal.driver === "technical" ? "เทคนิคัล" : ""
  const tip = `${signal.summary}\n` +
    `Technical ${signal.technicalScore}/100${signal.technicalReasons.length ? ": " + signal.technicalReasons.join(" · ") : ""}\n` +
    `Thesis ${signal.thesisScore}/100${signal.thesisReasons.length ? ": " + signal.thesisReasons.join(" · ") : ""}\n` +
    `→ ${signal.suggestedAction}`
  return (
    <span title={tip} className={cn("text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded border", cfg.color)}>
      ⚠ {cfg.label}{driverTag && <span className="opacity-70 font-normal"> · {driverTag}</span>}
    </span>
  )
}

function EarningsBadge({ days }: { days: number }) {
  const color = days <= 2 ? "text-red-300 bg-red-500/15 border-red-500/40"
    : days <= 5 ? "text-orange-300 bg-orange-500/10 border-orange-500/30"
    : "text-gray-400 bg-gray-700/30 border-gray-700"
  return (
    <span title={`ประกาศงบในอีก ${days} วัน — event risk (อาจ ±10-20%) · ไม่เพิ่มไม้ก่อนงบ`}
      className={cn("text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded border", color)}>
      📅 งบ {days}d
    </span>
  )
}

function StrategyBadge({ strategy }: { strategy: "dca" | "swing" | "spec" }) {
  const cfg = strategy === "dca"
    ? { label: "DCA",   color: "text-amber-300 bg-amber-500/15 border-amber-500/40",
        tip: "Long-term DCA · accumulate at Fibonacci 38.2 / 50 / 61.8" }
    : strategy === "swing"
    ? { label: "SWING", color: "text-cyan-300 bg-cyan-500/15 border-cyan-500/40",
        tip: "Short-term swing · bounce at Pivot S1, sell at R1/R2" }
    : { label: "SPEC",  color: "text-fuchsia-300 bg-fuchsia-500/15 border-fuchsia-500/40",
        tip: "Speculative momentum · high risk · no fixed entry/exit" }
  return (
    <span title={cfg.tip} className={`text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded border ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}
