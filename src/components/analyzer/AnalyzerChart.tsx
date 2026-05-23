"use client"

import { useState, useMemo } from "react"
import type { AnalyzerResult } from "@/lib/stockAnalyzer"
import { cn } from "@/lib/utils"
import { Maximize2 } from "lucide-react"

const TF_OPTIONS = [
  { label: "1D",  bars: 30  },
  { label: "1W",  bars: 60  },
  { label: "1M",  bars: 100 },
  { label: "3M",  bars: 130 },
  { label: "6M",  bars: 180 },
  { label: "1Y",  bars: 252 },
] as const

const EMA_COLORS = {
  ema15:  "#fbbf24",  // amber
  ema30:  "#a78bfa",  // violet
  ema50:  "#22d3ee",  // cyan
  ema100: "#ec4899",  // pink
  ema200: "#10b981",  // emerald
}

export function AnalyzerChart({ result }: { result: AnalyzerResult }) {
  const [tf, setTf] = useState<typeof TF_OPTIONS[number]["label"]>("3M")
  const [showCandles, setShowCandles] = useState(true)

  const cfg = TF_OPTIONS.find(o => o.label === tf)!
  const visibleBars = cfg.bars

  const chart = useMemo(() => buildChart(result, visibleBars), [result, visibleBars])

  return (
    <div className="bg-[#0C1628] border border-[#1A2E52] rounded-2xl p-4 hsr-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-widest">Chart Overview</div>
          <div className="text-sm text-white font-semibold">
            Timeframe {tf} for {result.ticker} · daily candles
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Candle/Line toggle */}
          <div className="flex bg-[#070B18] border border-[#1A2E52] rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setShowCandles(false)}
              className={cn("px-2 py-0.5 rounded transition-colors", !showCandles ? "bg-[#00C2D4]/20 text-[#00D8EE]" : "text-gray-500")}
            >เส้น</button>
            <button
              onClick={() => setShowCandles(true)}
              className={cn("px-2 py-0.5 rounded transition-colors", showCandles ? "bg-[#00C2D4]/20 text-[#00D8EE]" : "text-gray-500")}
            >แท่ง</button>
          </div>
          <button className="text-gray-500 hover:text-white p-1">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Timeframe pills */}
      <div className="flex gap-1 mb-3 text-xs">
        {TF_OPTIONS.map(opt => (
          <button
            key={opt.label}
            onClick={() => setTf(opt.label)}
            className={cn(
              "px-2.5 py-1 rounded font-medium transition-colors",
              tf === opt.label
                ? "bg-[#00C2D4]/15 text-[#00D8EE] border border-[#00C2D4]/40"
                : "text-gray-500 hover:text-gray-300 border border-transparent"
            )}
          >{opt.label}</button>
        ))}
      </div>

      {/* EMA legend */}
      <div className="flex gap-3 mb-2 text-[10px] flex-wrap">
        <span className="text-gray-500">EMA</span>
        {[
          { label: "15", val: chart.lastEma.ema15, color: EMA_COLORS.ema15 },
          { label: "30", val: chart.lastEma.ema30, color: EMA_COLORS.ema30 },
          { label: "50", val: chart.lastEma.ema50, color: EMA_COLORS.ema50 },
          { label: "100", val: chart.lastEma.ema100, color: EMA_COLORS.ema100 },
          { label: "200", val: chart.lastEma.ema200, color: EMA_COLORS.ema200 },
        ].map(e => (
          <span key={e.label} className="flex items-center gap-1">
            <span className="w-2 h-0.5" style={{ background: e.color }} />
            <span className="text-gray-400">{e.label}:</span>
            <span style={{ color: e.color }}>{e.val.toFixed(2)}</span>
          </span>
        ))}
      </div>

      {/* SVG Chart */}
      <div className="relative">
        <svg viewBox="0 0 800 360" className="w-full h-72">
          {/* Grid */}
          {[0, 0.25, 0.5, 0.75, 1].map(p => (
            <line key={p} x1="0" y1={20 + p * 280} x2="800" y2={20 + p * 280} stroke="#1A2E52" strokeWidth="0.5" strokeDasharray="2,2" />
          ))}

          {/* Candlesticks or line */}
          {showCandles ? (
            chart.bars.map((b, i) => {
              const up = b.close >= b.open
              return (
                <g key={i}>
                  <line x1={b.x} y1={b.high} x2={b.x} y2={b.low}
                    stroke={up ? "#22c55e" : "#ef4444"} strokeWidth="0.7" />
                  <rect
                    x={b.x - chart.candleW/2}
                    y={Math.min(b.openY, b.closeY)}
                    width={chart.candleW}
                    height={Math.max(1, Math.abs(b.closeY - b.openY))}
                    fill={up ? "#22c55e" : "#ef4444"}
                  />
                </g>
              )
            })
          ) : (
            <path d={chart.linePath} fill="none" stroke="#00C2D4" strokeWidth="1.5" />
          )}

          {/* EMA lines */}
          <path d={chart.ema15Path}  fill="none" stroke={EMA_COLORS.ema15}  strokeWidth="1" opacity="0.8" />
          <path d={chart.ema30Path}  fill="none" stroke={EMA_COLORS.ema30}  strokeWidth="1" opacity="0.8" />
          <path d={chart.ema50Path}  fill="none" stroke={EMA_COLORS.ema50}  strokeWidth="1.2" />
          <path d={chart.ema100Path} fill="none" stroke={EMA_COLORS.ema100} strokeWidth="1" opacity="0.8" />
          <path d={chart.ema200Path} fill="none" stroke={EMA_COLORS.ema200} strokeWidth="1.2" />

          {/* TP zone overlay */}
          <line x1="0" y1={chart.priceToY(result.tradeLevels.tp1)} x2="800" y2={chart.priceToY(result.tradeLevels.tp1)} stroke="#10b981" strokeWidth="1" strokeDasharray="3,2" opacity="0.6" />
          <line x1="0" y1={chart.priceToY(result.tradeLevels.tp2)} x2="800" y2={chart.priceToY(result.tradeLevels.tp2)} stroke="#10b981" strokeWidth="1" strokeDasharray="3,2" opacity="0.5" />
          <line x1="0" y1={chart.priceToY(result.tradeLevels.tp3)} x2="800" y2={chart.priceToY(result.tradeLevels.tp3)} stroke="#10b981" strokeWidth="1" strokeDasharray="3,2" opacity="0.4" />

          {/* Accumulation zone (filled rect) */}
          <rect
            x="0" y={chart.priceToY(result.tradeLevels.tradeAccumHigh)}
            width="800"
            height={Math.abs(chart.priceToY(result.tradeLevels.tradeAccumLow) - chart.priceToY(result.tradeLevels.tradeAccumHigh))}
            fill="#ec4899" opacity="0.08"
          />

          {/* SL line */}
          <line x1="0" y1={chart.priceToY(result.tradeLevels.sl)} x2="800" y2={chart.priceToY(result.tradeLevels.sl)} stroke="#ef4444" strokeWidth="1" strokeDasharray="4,2" />

          {/* Current price line */}
          <line x1="0" y1={chart.priceToY(result.snapshot.currentPrice)} x2="800" y2={chart.priceToY(result.snapshot.currentPrice)} stroke="#ffffff" strokeWidth="0.5" opacity="0.6" />
        </svg>

        {/* Right-side price labels */}
        <div className="absolute right-0 top-0 bottom-0 w-20 flex flex-col text-[10px] font-mono pr-1 pointer-events-none">
          {chart.yLabels.map((y, i) => (
            <div key={i}
              className="absolute text-right w-full pr-2 text-gray-500"
              style={{ top: `calc(${(y.y / 360) * 100}% - 6px)` }}
            >
              ${y.price.toFixed(2)}
            </div>
          ))}
          {/* Annotated levels */}
          <PriceLabel y={chart.priceToY(result.tradeLevels.tp3)} text={`TP3 $${result.tradeLevels.tp3.toFixed(2)}`} color="#10b981" />
          <PriceLabel y={chart.priceToY(result.tradeLevels.tp2)} text={`TP2 $${result.tradeLevels.tp2.toFixed(2)}`} color="#10b981" />
          <PriceLabel y={chart.priceToY(result.tradeLevels.tp1)} text={`TP1 $${result.tradeLevels.tp1.toFixed(2)}`} color="#10b981" />
          <PriceLabel y={chart.priceToY(result.tradeLevels.tradeAccumHigh)} text={`Accum $${result.tradeLevels.tradeAccumHigh.toFixed(2)}`} color="#ec4899" />
          <PriceLabel y={chart.priceToY(result.snapshot.currentPrice)} text={`$${result.snapshot.currentPrice.toFixed(2)}`} color="#ffffff" bold />
          <PriceLabel y={chart.priceToY(result.tradeLevels.sl)} text={`SL $${result.tradeLevels.sl.toFixed(2)}`} color="#ef4444" />
        </div>
      </div>

      {/* Footer info */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-3 text-[10px] text-gray-500 border-t border-[#1A2E52] pt-2">
        <div><div className="text-gray-600">Range</div><div className="text-white">{tf}</div></div>
        <div><div className="text-gray-600">Candle</div><div className="text-white">1D</div></div>
        <div><div className="text-gray-600">High</div><div className="text-white">${chart.high.toFixed(2)}</div></div>
        <div><div className="text-gray-600">Low</div><div className="text-white">${chart.low.toFixed(2)}</div></div>
        <div><div className="text-gray-600">Last</div><div className="text-white">${result.snapshot.currentPrice.toFixed(2)}</div></div>
        <div><div className="text-gray-600">Window</div><div className="text-white">{visibleBars}d</div></div>
      </div>
    </div>
  )
}

function PriceLabel({ y, text, color, bold = false }: { y: number; text: string; color: string; bold?: boolean }) {
  return (
    <div
      className={cn("absolute right-0 px-1 rounded text-[9px] whitespace-nowrap", bold && "font-bold")}
      style={{
        top: `calc(${(y / 360) * 100}% - 7px)`,
        background: color + "22",
        color,
        border: `1px solid ${color}55`,
      }}
    >
      {text}
    </div>
  )
}

// ─── Chart geometry helper ──────────────────────────────────────────────────

function buildChart(result: AnalyzerResult, visibleBars: number) {
  const candles = result.candles
  const allLen = candles.c.length
  const start = Math.max(0, allLen - visibleBars)
  const closes = candles.c.slice(start)
  const opens  = candles.o.slice(start)
  const highs  = candles.h.slice(start)
  const lows   = candles.l.slice(start)

  // Find price range, include TP3 + SL so they show
  const tpHigh = result.tradeLevels.tp3
  const slLow  = result.tradeLevels.sl
  const high = Math.max(...highs, tpHigh)
  const low  = Math.min(...lows,  slLow)
  const pad  = (high - low) * 0.05
  const yMax = high + pad
  const yMin = Math.max(0, low - pad)

  const W = 780  // leave room for right labels
  const H = 320
  const Y_OFFSET = 20

  const xStep = W / Math.max(closes.length, 1)
  const candleW = Math.max(1, Math.min(8, xStep * 0.7))

  const priceToY = (p: number) => Y_OFFSET + ((yMax - p) / (yMax - yMin)) * H

  const bars = closes.map((c, i) => {
    const x = i * xStep + xStep / 2
    return {
      x,
      open: opens[i], close: c,
      // SVG-pixel coordinates (used directly by candle/wick rendering)
      high: priceToY(highs[i]),
      low:  priceToY(lows[i]),
      openY: priceToY(opens[i]),
      closeY: priceToY(c),
    }
  })

  // Build line path (close only)
  const linePath = closes.map((c, i) => `${i === 0 ? "M" : "L"} ${i * xStep + xStep/2} ${priceToY(c)}`).join(" ")

  // EMA paths — align to last visibleBars
  function emaPath(ema: number[]) {
    const slice = ema.slice(Math.max(0, ema.length - closes.length))
    return slice.map((v, i) => `${i === 0 ? "M" : "L"} ${i * xStep + xStep/2} ${priceToY(v)}`).join(" ")
  }

  // Y-axis labels (5 ticks)
  const yLabels = [0, 0.25, 0.5, 0.75, 1].map(p => ({
    y: Y_OFFSET + p * H,
    price: yMax - p * (yMax - yMin),
  }))

  return {
    bars,
    linePath,
    ema15Path:  emaPath(result.ema15),
    ema30Path:  emaPath(result.ema30),
    ema50Path:  emaPath(result.ema50),
    ema100Path: emaPath(result.ema100),
    ema200Path: emaPath(result.ema200),
    priceToY,
    candleW,
    high, low,
    yLabels,
    lastEma: {
      ema15:  result.ema15[result.ema15.length-1]   || 0,
      ema30:  result.ema30[result.ema30.length-1]   || 0,
      ema50:  result.ema50[result.ema50.length-1]   || 0,
      ema100: result.ema100[result.ema100.length-1] || 0,
      ema200: result.ema200[result.ema200.length-1] || 0,
    },
  }
}
