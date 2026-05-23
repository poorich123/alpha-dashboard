"use client"

import { useState } from "react"
import { Activity, Check, X, Minus } from "lucide-react"
import type { ThesisCheck } from "@/lib/stockAnalyzer"
import { cn } from "@/lib/utils"

interface Props {
  checks: ThesisCheck[]
}

function StatusBadge({ status }: { status: ThesisCheck["status"] }) {
  if (status === "PASS") return (
    <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
      <Check className="w-2.5 h-2.5" /> PASS
    </span>
  )
  if (status === "FAIL") return (
    <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 flex items-center gap-1">
      <X className="w-2.5 h-2.5" /> FAIL
    </span>
  )
  return (
    <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 flex items-center gap-1">
      <Minus className="w-2.5 h-2.5" /> N/A
    </span>
  )
}

export function TechnicalThesis({ checks }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const passCount = checks.filter(c => c.status === "PASS").length
  const failCount = checks.filter(c => c.status === "FAIL").length
  const naCount   = checks.filter(c => c.status === "NEUTRAL").length
  // Effective denominator excludes N/A — matches Analyzer header scoring
  const effectiveTotal = passCount + failCount
  const total = effectiveTotal > 0 ? effectiveTotal : checks.length
  const passPct = total > 0 ? (passCount / total) * 100 : 0

  // Quick filter buttons (shows only matching check by id when clicked)
  const filterPills = [
    { id: "rsi",      label: "RSI" },
    { id: "macd",     label: "MACD" },
    { id: "bb",       label: "BOLL" },
    { id: "vol",      label: "VOL" },
    { id: "breakout", label: "BREAKOUT" },
    { id: "pe",       label: "PE" },
    { id: "rs",       label: "RS" },
  ]

  const visible = selectedId
    ? checks.filter(c => c.id === selectedId)
    : checks

  return (
    <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-4 hsr-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#1A2E52]">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-white">Technical Thesis</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {passCount}/{total} passed
            {naCount > 0 && <span className="text-gray-600"> · {naCount} N/A excluded</span>}
          </span>
          <span className={cn(
            "text-xs font-bold px-2 py-0.5 rounded",
            passPct >= 75 ? "bg-emerald-500/15 text-emerald-400"
            : passPct >= 50 ? "bg-yellow-500/15 text-yellow-400"
            : "bg-red-500/15 text-red-400"
          )}>
            {passPct.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <button
          onClick={() => setSelectedId(null)}
          className={cn(
            "text-[10px] px-2 py-1 rounded border font-semibold transition-colors",
            !selectedId
              ? "bg-[#00C2D4]/15 text-[#00D8EE] border-[#00C2D4]/40"
              : "bg-transparent text-gray-500 border-[#1A2E52] hover:border-[#00C2D4]/30"
          )}
        >
          ALL
        </button>
        {filterPills.map(pill => {
          const check = checks.find(c => c.id === pill.id)
          if (!check) return null
          return (
            <button
              key={pill.id}
              onClick={() => setSelectedId(pill.id === selectedId ? null : pill.id)}
              className={cn(
                "text-[10px] px-2 py-1 rounded border font-semibold transition-colors",
                pill.id === selectedId
                  ? "bg-[#00C2D4]/15 text-[#00D8EE] border-[#00C2D4]/40"
                  : check.status === "PASS"
                  ? "bg-transparent text-gray-400 border-[#1A2E52] hover:border-emerald-500/30"
                  : check.status === "FAIL"
                  ? "bg-transparent text-gray-500 border-[#1A2E52] hover:border-red-500/30"
                  : "bg-transparent text-gray-500 border-[#1A2E52]"
              )}
            >
              {pill.label}
            </button>
          )
        })}
      </div>

      {/* Check rows */}
      <div className="space-y-2">
        {visible.map((c) => (
          <div
            key={c.id}
            className={cn(
              "rounded-lg p-3 border transition-colors",
              c.status === "PASS"
                ? "bg-emerald-500/5 border-emerald-500/15"
                : c.status === "FAIL"
                ? "bg-red-500/5 border-red-500/15"
                : "bg-gray-500/5 border-gray-700/30"
            )}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <div>
                <div className="text-sm font-semibold text-white">{c.label}</div>
                <div className="text-xs text-gray-400 font-mono mt-0.5">{c.value}</div>
              </div>
              <StatusBadge status={c.status} />
            </div>
            <div className="text-[11px] text-gray-500 leading-relaxed">{c.description}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
