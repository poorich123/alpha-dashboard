"use client"

/**
 * Mini SVG sparkline — 80x32 trend chart for table cells
 * Auto-detects bullish/bearish from first vs last value
 */
export function Sparkline({ data, width = 80, height = 32 }: { data: number[]; width?: number; height?: number }) {
  if (data.length < 2) return <div className="w-20 h-8" />

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const stepX = width / (data.length - 1)

  const points = data.map((v, i) => {
    const x = i * stepX
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(" ")

  const bullish = data[data.length - 1] >= data[0]
  const color = bullish ? "#22c55e" : "#ef4444"
  const fillColor = bullish ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)"

  // Area path
  const areaPath = `M 0 ${height} L ${points.split(" ").join(" L ")} L ${width} ${height} Z`

  return (
    <svg width={width} height={height} className="overflow-visible">
      <path d={areaPath.replace(",", " ").replace(/,/g, " ")} fill={fillColor} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * Momentum bars — 6 small colored bars showing trend strength
 * across timeframes (1D, 1W, 1M, 3M, 6M, 1Y)
 */
export function MomentumBars({ gauges }: { gauges: { timeframe: string; score: number }[] }) {
  const barColor = (score: number) => {
    if (score >= 80) return "#10b981" // strong green
    if (score >= 60) return "#22c55e" // green
    if (score >= 40) return "#eab308" // yellow
    if (score >= 20) return "#f97316" // orange
    return "#ef4444"                  // red
  }

  return (
    <div className="flex items-end gap-0.5">
      {gauges.map((g) => (
        <div key={g.timeframe} className="flex flex-col items-center gap-0.5">
          <div className="text-[8px] text-gray-600 uppercase">{g.timeframe}</div>
          <div
            className="w-3 h-3 rounded-sm"
            style={{ background: barColor(g.score) }}
            title={`${g.timeframe}: ${g.score}/100`}
          />
        </div>
      ))}
    </div>
  )
}
