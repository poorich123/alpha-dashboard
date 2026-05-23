"use client"

import Link from "next/link"
import { TrendingUp, TrendingDown } from "lucide-react"
import { Sparkline, MomentumBars } from "./Sparkline"
import { cn } from "@/lib/utils"
import type { MarketScanResult } from "@/lib/marketOverview"

interface Props {
  stocks: MarketScanResult[]
  loading?: boolean
}

function signalColor(signal: string): string {
  if (signal === "STRONG BUY") return "text-emerald-400 bg-emerald-500/15 border-emerald-500/40"
  if (signal === "BUY")        return "text-green-400 bg-green-500/15 border-green-500/30"
  if (signal === "HOLD")       return "text-yellow-400 bg-yellow-500/15 border-yellow-500/30"
  if (signal === "SELL")       return "text-orange-400 bg-orange-500/15 border-orange-500/30"
  return "text-red-400 bg-red-500/15 border-red-500/30"
}

function confColor(c: string): string {
  if (c === "HIGH")   return "text-emerald-400"
  if (c === "MEDIUM") return "text-yellow-400"
  return "text-red-400"
}

export function StockTable({ stocks, loading }: Props) {
  if (stocks.length === 0 && !loading) {
    return (
      <div className="bg-[#0C1628] border border-[#1A2E52] rounded-2xl p-12 text-center text-gray-500">
        No stocks scanned yet. Click <span className="text-cyan-400">Scan Market</span> to begin.
      </div>
    )
  }

  return (
    <div className="bg-[#0C1628] border border-[#1A2E52] rounded-2xl overflow-hidden hsr-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#070B18]/80 border-b border-[#1A2E52] sticky top-0">
            <tr className="text-[10px] text-gray-500 uppercase tracking-wider">
              <th className="text-left py-3 pl-4 pr-2">#</th>
              <th className="text-left py-3 px-2">Ticker</th>
              <th className="text-right py-3 px-2">MCap</th>
              <th className="text-left py-3 px-2">Trend</th>
              <th className="text-center py-3 px-2">Signal</th>
              <th className="text-center py-3 px-2">Conf</th>
              <th className="text-center py-3 px-2">Score</th>
              <th className="text-right py-3 px-2">Price</th>
              <th className="text-right py-3 px-2">Change</th>
              <th className="text-right py-3 px-2">TP1</th>
              <th className="text-right py-3 px-2">Accum Zone</th>
              <th className="text-center py-3 px-3 pr-4">Momentum</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((s, i) => (
              <StockRow key={s.ticker} stock={s} rank={i + 1} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StockRow({ stock: s, rank }: { stock: MarketScanResult; rank: number }) {
  const isUp = s.changePct >= 0
  const sigCol = signalColor(s.signal)
  const confCol = confColor(s.confidence)

  return (
    <tr className="border-b border-[#1A2E52]/40 hover:bg-[#070B18]/40 transition-colors">
      {/* Rank */}
      <td className="py-3 pl-4 pr-2 text-gray-500 text-xs font-medium">{rank}</td>

      {/* Ticker + Company */}
      <td className="py-3 px-2">
        <Link
          href={`/analyzer?ticker=${s.ticker}`}
          className="flex items-center gap-2 group"
        >
          {s.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={s.logo}
              alt=""
              className="w-7 h-7 rounded bg-white/5 object-contain p-0.5"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          ) : (
            <div className="w-7 h-7 rounded bg-[#1A2E52] flex items-center justify-center text-[9px] font-bold text-cyan-400">
              {s.ticker.slice(0, 2)}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-white font-semibold text-sm group-hover:text-cyan-300 transition-colors">{s.ticker}</div>
            <div className="text-[10px] text-gray-500 truncate max-w-[120px]">{s.companyName}</div>
          </div>
        </Link>
      </td>

      {/* Market Cap */}
      <td className="py-3 px-2 text-right">
        <span className={cn(
          "text-xs font-mono font-medium",
          s.marketCapNum >= 1e12 ? "text-cyan-300"
          : s.marketCapNum >= 1e11 ? "text-cyan-400"
          : s.marketCapNum >= 1e10 ? "text-gray-300"
          : "text-gray-500"
        )}>
          {s.marketCap}
        </span>
      </td>

      {/* Trend Sparkline */}
      <td className="py-3 px-2">
        <Sparkline data={s.trend30d} width={80} height={32} />
      </td>

      {/* Signal */}
      <td className="py-3 px-2 text-center">
        <span className={cn("text-[10px] font-bold px-2 py-1 rounded border", sigCol)}>
          {s.signal}
        </span>
      </td>

      {/* Confidence */}
      <td className={cn("py-3 px-2 text-center text-xs font-semibold", confCol)}>
        {s.confidence}
      </td>

      {/* Score */}
      <td className="py-3 px-2 text-center">
        <div className="flex items-center gap-1.5 justify-center">
          {Array(s.scoreMax).fill(0).map((_, i) => (
            <div key={i}
              className={cn("w-1.5 h-1.5 rounded-full", i < s.score ? "bg-emerald-400" : "bg-gray-700")}
            />
          ))}
          <span className="text-[10px] text-gray-500 ml-1">{s.score}/{s.scoreMax}</span>
        </div>
      </td>

      {/* Price */}
      <td className="py-3 px-2 text-right text-white font-mono text-sm">${s.currentPrice.toFixed(2)}</td>

      {/* Change */}
      <td className={cn("py-3 px-2 text-right text-xs font-mono font-semibold", isUp ? "text-emerald-400" : "text-red-400")}>
        <div className="inline-flex items-center gap-0.5">
          {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {isUp ? "+" : ""}{s.changePct.toFixed(2)}%
        </div>
      </td>

      {/* TP1 */}
      <td className="py-3 px-2 text-right text-emerald-400 font-mono text-xs">${s.tp1.toFixed(2)}</td>

      {/* Accumulation Zone */}
      <td className="py-3 px-2 text-right text-pink-400 font-mono text-xs">
        ${s.accumLow.toFixed(2)}–{s.accumHigh.toFixed(2)}
      </td>

      {/* Momentum bars */}
      <td className="py-3 px-3 pr-4">
        <div className="flex justify-center">
          <MomentumBars gauges={s.gauges} />
        </div>
      </td>
    </tr>
  )
}
