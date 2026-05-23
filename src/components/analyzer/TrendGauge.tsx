"use client"

import type { TrendStrengthGauge } from "@/lib/stockAnalyzer"
import { cn } from "@/lib/utils"

interface Props {
  gauge: TrendStrengthGauge
  compact?: boolean
}

export function TrendGauge({ gauge, compact = false }: Props) {
  const { timeframe, score, label } = gauge

  // Map score (0-100) to angle on a half-circle (-90 to +90 degrees)
  const angleDeg = -90 + (score / 100) * 180
  const radius = compact ? 38 : 50
  const cx = compact ? 50 : 70
  const cy = compact ? 50 : 70
  const strokeW = compact ? 8 : 11

  // Needle endpoint
  const rad = (angleDeg * Math.PI) / 180
  const needleX = cx + (radius - strokeW/2) * Math.sin(rad)
  const needleY = cy - (radius - strokeW/2) * Math.cos(rad)

  // Color based on score
  const color =
    score >= 80 ? "#10b981" :  // strong buy: emerald
    score >= 60 ? "#22c55e" :  // buy: green
    score >= 40 ? "#eab308" :  // neutral: yellow
    score >= 20 ? "#f97316" :  // sell: orange
                  "#ef4444"     // strong sell: red

  // Gradient stops for the arc background (red → yellow → green)
  const w = compact ? 100 : 140
  const h = compact ? 70 : 90
  const gradId = `gauge-grad-${timeframe}`

  // Build arc path (half-circle)
  const arcPath = (() => {
    const startAngle = -90
    const endAngle   = 90
    const r = radius - strokeW/2
    const startRad = (startAngle * Math.PI) / 180
    const endRad   = (endAngle * Math.PI) / 180
    const x1 = cx + r * Math.sin(startRad)
    const y1 = cy - r * Math.cos(startRad)
    const x2 = cx + r * Math.sin(endRad)
    const y2 = cy - r * Math.cos(endRad)
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`
  })()

  return (
    <div className={cn(
      "relative rounded-xl border bg-[#0C1628] flex flex-col items-center justify-center transition-all",
      compact ? "p-2" : "p-3",
      "border-[#1A2E52] hover:border-[#00C2D4]/30"
    )}>
      {/* Timeframe label top */}
      <div className={cn("text-gray-400 font-medium tracking-wide", compact ? "text-[10px]" : "text-xs")}>{timeframe}</div>

      {/* Label below timeframe */}
      <div className={cn(
        "font-semibold mb-1",
        compact ? "text-[10px]" : "text-xs",
      )} style={{ color }}>
        {label}
      </div>

      {/* SVG Gauge */}
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h}>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"  stopColor="#ef4444" stopOpacity="0.5" />
            <stop offset="25%" stopColor="#f97316" stopOpacity="0.5" />
            <stop offset="50%" stopColor="#eab308" stopOpacity="0.5" />
            <stop offset="75%" stopColor="#22c55e" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.5" />
          </linearGradient>
        </defs>

        {/* Background arc */}
        <path d={arcPath} fill="none" stroke={`url(#${gradId})`} strokeWidth={strokeW} strokeLinecap="round" />

        {/* Tick marks */}
        {[0, 25, 50, 75, 100].map((tick) => {
          const tickAngle = -90 + (tick / 100) * 180
          const tickRad = (tickAngle * Math.PI) / 180
          const inner = radius - strokeW - 2
          const outer = radius - strokeW/2 + 2
          const x1 = cx + inner * Math.sin(tickRad)
          const y1 = cy - inner * Math.cos(tickRad)
          const x2 = cx + outer * Math.sin(tickRad)
          const y2 = cy - outer * Math.cos(tickRad)
          return <line key={tick} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#1A2E52" strokeWidth="1" />
        })}

        {/* Needle */}
        <line
          x1={cx} y1={cy}
          x2={needleX} y2={needleY}
          stroke={color} strokeWidth={compact ? 2 : 2.5}
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={compact ? 3 : 4} fill={color} />

        {/* Score text */}
        <text
          x={cx} y={cy + (compact ? 14 : 18)}
          textAnchor="middle"
          className="font-bold"
          fontSize={compact ? "11" : "14"}
          fill={color}
        >
          {score}
        </text>
      </svg>

      {/* Edge labels */}
      <div className={cn("flex justify-between w-full px-1", compact ? "text-[8px]" : "text-[10px]", "text-gray-600")}>
        <span>ขายแรง</span>
        <span>ซื้อแรง</span>
      </div>
    </div>
  )
}

interface TrendGaugeGridProps {
  gauges: TrendStrengthGauge[]
  view?: "single" | "all"
}

export function TrendGaugeGrid({ gauges, view = "all" }: TrendGaugeGridProps) {
  if (view === "single") {
    return <TrendGauge gauge={gauges[0]} />
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {gauges.map((g) => (
        <TrendGauge key={g.timeframe} gauge={g} />
      ))}
    </div>
  )
}
