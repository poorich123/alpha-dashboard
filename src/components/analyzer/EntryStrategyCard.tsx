"use client"

import { useState } from "react"
import { AlertTriangle, Sparkles, Target, ChevronDown, ChevronUp, Clock, Repeat, Info } from "lucide-react"
import type { EntryRecommendation, TradeLevels } from "@/lib/stockAnalyzer"
import type { FibLevels } from "@/lib/technical"
import type { TradingStrategy } from "@/types"
import { cn } from "@/lib/utils"

interface Props {
  rec: EntryRecommendation
  levels: TradeLevels
  ticker: string
  // Phase 2 additions:
  srLevels?: { support1: number; support2: number; resistance1: number; resistance2: number }
  fibLevels?: FibLevels | null
  // Strategy of the user's position (if held) — auto-highlights the matching plan
  positionStrategy?: TradingStrategy
}

type ViewMode = "swing" | "dca" | "both"

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

export function EntryStrategyCard({ rec, levels, srLevels, fibLevels, positionStrategy }: Props) {
  const [open, setOpen] = useState(true)
  const [showHelp, setShowHelp] = useState(false)
  // Default view: match position's strategy, else show both
  const defaultView: ViewMode = positionStrategy === "dca" ? "dca"
                              : positionStrategy === "swing" ? "swing"
                              : "both"
  const [view, setView] = useState<ViewMode>(defaultView)

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

          {/* ── Strategy view toggle ─────────────────────────────────── */}
          {rec.strategy !== "SKIP" && (srLevels || fibLevels) && (
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Target className="w-3 h-3" />Action Plan
                <button
                  onClick={() => setShowHelp(v => !v)}
                  className="ml-1 text-cyan-400 hover:text-cyan-300 normal-case tracking-normal flex items-center gap-0.5"
                  title="How to read this"
                >
                  <Info className="w-3 h-3" />
                  <span className="text-[10px]">How to read</span>
                </button>
                {positionStrategy && (
                  <span className="ml-1 text-[9px] text-gray-600">
                    (your position: <span className="text-cyan-400">{positionStrategy.toUpperCase()}</span>)
                  </span>
                )}
              </div>
              <div className="flex bg-[#070B18] border border-[#1A2E52] rounded-lg p-0.5 text-[10px]">
                {(["swing", "dca", "both"] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setView(m)}
                    className={cn(
                      "px-2 py-0.5 rounded transition-colors font-semibold",
                      view === m ? "bg-[#00C2D4]/20 text-[#00D8EE]" : "text-gray-500 hover:text-gray-300",
                    )}
                  >
                    {m === "swing" ? "🔵 SWING" : m === "dca" ? "🟡 DCA" : "Both"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── How to read panel ─────────────────────────────────────── */}
          {showHelp && rec.strategy !== "SKIP" && (
            <div className="bg-[#070B18]/80 border border-cyan-500/20 rounded-lg p-3 mb-3 text-[11px] leading-relaxed">
              <div className="font-semibold text-cyan-300 mb-2 flex items-center gap-1">
                <Info className="w-3.5 h-3.5" />
                3 buy-zone systems — เลือกตาม strategy
              </div>
              <div className="space-y-2 text-gray-400">
                <div className="flex gap-2">
                  <span className="text-emerald-400 font-mono text-[10px] flex-shrink-0 mt-0.5">🟢 SWING</span>
                  <span>
                    <strong className="text-cyan-300">Buy zone (โซนสะสม)</strong> — smart blend ของ Pivot S1 + BB middle + SMA50.
                    ใช้สำหรับ swing trade 1-4 สัปดาห์. <strong>Trust this for short-term entries.</strong>
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="text-amber-400 font-mono text-[10px] flex-shrink-0 mt-0.5">🟡 DCA</span>
                  <span>
                    <strong className="text-amber-300">Fib levels</strong> — 38.2% / 50% / 61.8% retracement จาก swing high-low 1 ปี.
                    ใช้สำหรับ DCA ระยะยาว (หลายเดือน-ปี). มัก<strong>ลึกกว่ามาก</strong>.
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="text-gray-500 font-mono text-[10px] flex-shrink-0 mt-0.5">🔵 Pivot</span>
                  <span>
                    <strong className="text-gray-300">Raw S1/S2</strong> — pivot lows 60 วันย้อนหลัง. <strong>Reference เฉย ๆ</strong> —
                    บางครั้งลึกเกินไปสำหรับ swing → ระบบจะใช้ smart blend แทน
                  </span>
                </div>
                <div className="pt-2 mt-2 border-t border-[#1A2E52]/60 text-cyan-200/80">
                  💡 <strong>กฎจำง่าย:</strong>
                  Swing trader → ใช้ "Buy zone" ใน SWING PLAN ·
                  DCA investor → ใช้ Fib 50%/61.8% ใน DCA PLAN ·
                  ไม่ต้องสนใจ Pivot S1 raw ถ้าไม่ใช่ trader มืออาชีพ
                </div>
              </div>
            </div>
          )}

          {/* ── Dual Action Plans ─────────────────────────────────────── */}
          {rec.strategy !== "SKIP" && (srLevels || fibLevels) && (
            <div className={cn(
              "grid gap-3 mb-3",
              view === "both" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
            )}>
              {/* SWING plan */}
              {(view === "swing" || view === "both") && srLevels && (
                <SwingPlanCard
                  current={current}
                  srLevels={srLevels}
                  levels={levels}
                  highlighted={positionStrategy === "swing"}
                />
              )}

              {/* DCA plan */}
              {(view === "dca" || view === "both") && (
                <DcaPlanCard
                  current={current}
                  fibLevels={fibLevels || null}
                  highlighted={positionStrategy === "dca"}
                />
              )}
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

// ─── Swing Plan Card — Pivot-based, short-term ─────────────────────────────
//
// Strategy: bounce at Pivot S1 → exit in tranches at R1/R2/TP targets.
// Time horizon: 1-4 weeks. Strict price-based stop loss.
//
interface SwingProps {
  current: number
  srLevels: NonNullable<Props["srLevels"]>
  levels: TradeLevels
  highlighted: boolean
}

function SwingPlanCard({ current, srLevels, levels, highlighted }: SwingProps) {
  // ── UNIFIED with Overview "โซนสะสม" ───────────────────────────────────────
  // Buy zone = tradeLevels.tradeAccumLow/High — same number shown on Overview
  // card. Uses smart fallback: S1 if near-term, else BB middle / SMA50 / price
  // floor. This is the SWING entry zone (1-4 week horizon).
  //
  // Pivot S1/S2 still shown below as "raw chart levels" for reference. When
  // the smart fallback diverges from raw S1, the user can see both numbers.
  const buyZoneLow  = levels.tradeAccumLow
  const buyZoneHigh = levels.tradeAccumHigh
  const inBuyZone = current <= buyZoneHigh && current >= buyZoneLow
  const distToZone = current > buyZoneHigh
    ? ((current - buyZoneHigh) / buyZoneHigh) * 100
    : current < buyZoneLow
    ? ((current - buyZoneLow) / buyZoneLow) * 100
    : 0

  // Show divergence note when raw Pivot S1 is far from smart accum zone
  const s1FarFromZone = Math.abs(srLevels.support1 - buyZoneLow) / buyZoneLow > 0.05

  return (
    <div className={cn(
      "rounded-xl border p-3 transition-all",
      highlighted
        ? "border-cyan-500/60 bg-cyan-500/5 ring-1 ring-cyan-500/30"
        : "border-[#1A2E52] bg-[#070B18]/60"
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-xs font-bold text-cyan-300">SWING PLAN</span>
          {highlighted && (
            <span className="text-[8px] font-bold bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-500/40">
              YOUR STRATEGY
            </span>
          )}
        </div>
        <span className="text-[9px] text-gray-600">Swing · 1-4w</span>
      </div>

      <div className="space-y-1 text-[11px] leading-relaxed">
        <div className="flex justify-between">
          <span className="text-gray-500" title="โซนสะสม (smart blend: S1/BB-middle/SMA50)">
            🟢 Buy zone (โซนสะสม)
          </span>
          <span className="font-mono text-cyan-300">
            ${buyZoneLow.toFixed(2)} – ${buyZoneHigh.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Current</span>
          <span className={cn("font-mono font-bold", inBuyZone ? "text-emerald-400" : "text-white")}>
            ${current.toFixed(2)}
            <span className="text-[9px] ml-1 text-gray-600">
              ({inBuyZone ? "in zone" : `${distToZone >= 0 ? "+" : ""}${distToZone.toFixed(1)}% from zone`})
            </span>
          </span>
        </div>
        <div className="flex justify-between border-t border-[#1A2E52]/60 pt-1 mt-1">
          <span className="text-red-400">🛑 SL</span>
          <span className="font-mono text-red-400">
            ${levels.sl.toFixed(2)} <span className="text-[9px] text-gray-600">({levels.slPct.toFixed(1)}%)</span>
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-emerald-400">🎯 TP1 — sell 40%</span>
          <span className="font-mono text-emerald-400">${levels.tp1.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-emerald-400">🎯 TP2 — sell 40%</span>
          <span className="font-mono text-emerald-400">${levels.tp2.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-emerald-400">🎯 TP3 — sell 20%</span>
          <span className="font-mono text-emerald-400">${levels.tp3.toFixed(2)}</span>
        </div>
        <div className="flex justify-between border-t border-[#1A2E52]/60 pt-1 mt-1">
          <span className="text-gray-500">⚖️ Risk/Reward</span>
          <span className={cn("font-mono", levels.riskReward >= 2 ? "text-emerald-400" : "text-yellow-400")}>
            {levels.riskReward.toFixed(2)}×
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">⏰ Time stop</span>
          <span className="text-gray-400">4 weeks if no TP1 hit</span>
        </div>

        {/* Raw Pivot reference (collapsible info row for advanced users) */}
        <div className="flex justify-between border-t border-[#1A2E52]/60 pt-1 mt-1 text-[10px] text-gray-600">
          <span title="Raw 5-bar pivot points (60-day lookback)">
            Pivot ref: S1 ${srLevels.support1.toFixed(2)} · S2 ${srLevels.support2.toFixed(2)}
          </span>
        </div>
      </div>

      {inBuyZone && (
        <div className="mt-2 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded px-2 py-1">
          ✓ Price IN buy zone — swing setup active
        </div>
      )}
      {!inBuyZone && s1FarFromZone && (
        <div className="mt-2 text-[10px] text-gray-500 bg-[#1A2E52]/30 rounded px-2 py-1">
          ℹ️ Pivot S1 (${srLevels.support1.toFixed(2)}) is far from smart buy zone — using BB/SMA50 blend instead (safer for swing)
        </div>
      )}
    </div>
  )
}

// ─── DCA Plan Card — Fibonacci-based, long-term ────────────────────────────
//
// Strategy: accumulate in tranches at Fib 38.2 / 50 / 61.8 retracements.
// No price-based stop loss — exit only on thesis change. Hold months-to-years.
//
interface DcaProps {
  current: number
  fibLevels: FibLevels | null
  highlighted: boolean
}

function DcaPlanCard({ current, fibLevels, highlighted }: DcaProps) {
  if (!fibLevels) {
    return (
      <div className={cn(
        "rounded-xl border p-3",
        highlighted ? "border-amber-500/60 bg-amber-500/5 ring-1 ring-amber-500/30" : "border-[#1A2E52] bg-[#070B18]/60"
      )}>
        <div className="flex items-center gap-1.5 mb-2">
          <Repeat className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-bold text-amber-300">DCA PLAN</span>
        </div>
        <div className="text-[11px] text-gray-500 text-center py-3">
          Not enough price history for Fibonacci analysis (need 30+ days)
        </div>
      </div>
    )
  }

  // Tranche definitions — buy more at deeper retracements
  const tranches = [
    { fib: "23.6%", price: fibLevels.level_236, size: 15 },
    { fib: "38.2%", price: fibLevels.level_382, size: 25 },
    { fib: "50%",   price: fibLevels.level_500, size: 25 },
    { fib: "61.8%", price: fibLevels.level_618, size: 25 },  // Golden ratio
    { fib: "78.6%", price: fibLevels.level_786, size: 10 },  // Deep value
  ]

  // Direction-aware: in uptrend, levels are BELOW price (retrace down); reverse for downtrend
  // Find tranches still actionable (price hasn't passed them in retracement direction)
  const actionable = tranches.filter(t =>
    fibLevels.direction === "up" ? t.price < current : t.price > current
  )

  return (
    <div className={cn(
      "rounded-xl border p-3 transition-all",
      highlighted
        ? "border-amber-500/60 bg-amber-500/5 ring-1 ring-amber-500/30"
        : "border-[#1A2E52] bg-[#070B18]/60"
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Repeat className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-bold text-amber-300">DCA PLAN</span>
          {highlighted && (
            <span className="text-[8px] font-bold bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/40">
              YOUR STRATEGY
            </span>
          )}
        </div>
        <span className="text-[9px] text-gray-600">
          Fib · {fibLevels.direction === "up" ? "Uptrend pullback" : "Downtrend bounce"}
        </span>
      </div>

      <div className="space-y-1 text-[11px] leading-relaxed">
        <div className="flex justify-between">
          <span className="text-gray-500">Swing high</span>
          <span className="font-mono text-amber-300">${fibLevels.swingHigh.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Swing low</span>
          <span className="font-mono text-amber-300">${fibLevels.swingLow.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Current</span>
          <span className="font-mono font-bold text-white">${current.toFixed(2)}</span>
        </div>

        <div className="border-t border-[#1A2E52]/60 pt-1 mt-1 mb-1">
          <div className="text-[9px] text-gray-600 uppercase tracking-wider mb-1">Tranche Targets</div>
          {tranches.map(t => {
            const isPast = fibLevels.direction === "up" ? t.price >= current : t.price <= current
            const pct = ((t.price - current) / current) * 100
            return (
              <div key={t.fib} className={cn("flex justify-between text-[10px]", isPast && "opacity-30")}>
                <span className={cn(
                  "font-mono",
                  t.fib === "50%" || t.fib === "61.8%" ? "text-amber-300 font-bold" : "text-gray-500"
                )}>
                  Fib {t.fib} → buy {t.size}%
                </span>
                <span className="font-mono text-amber-400">
                  ${t.price.toFixed(2)}
                  <span className="text-gray-600 ml-1">({pct >= 0 ? "+" : ""}{pct.toFixed(1)}%)</span>
                </span>
              </div>
            )
          })}
        </div>

        <div className="flex justify-between border-t border-[#1A2E52]/60 pt-1 mt-1">
          <span className="text-gray-500">🛑 Cut loss</span>
          <span className="text-gray-300">
            <span className="text-[9px]">Thesis change · </span>
            <span className="font-mono text-red-400">&lt;${fibLevels.level_786.toFixed(2)}</span>
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">🎯 Hold target</span>
          <span className="text-gray-300 text-[10px]">No fixed TP · re-evaluate at swing high</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">⏰ Time horizon</span>
          <span className="text-gray-400">Months to years</span>
        </div>
      </div>

      {actionable.length > 0 && (
        <div className="mt-2 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1">
          🟡 Next DCA tranche: {actionable[0].fib} at ${actionable[0].price.toFixed(2)}
        </div>
      )}
    </div>
  )
}
