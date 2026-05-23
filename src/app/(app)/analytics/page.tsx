"use client"

import { usePortfolioStore } from "@/store/portfolioStore"
import { getTrades, getSnapshots } from "@/lib/portfolio"
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts"
import { TrendingUp, TrendingDown, Target, DollarSign } from "lucide-react"
import { differenceInDays, parseISO, format } from "date-fns"

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

export default function AnalyticsPage() {
  const { positions, stats, settings } = usePortfolioStore()
  const trades = getTrades()
  const snapshots = getSnapshots()

  const activePositions = positions.filter((p) => p.isActive && p.category !== "watchlist")

  // Closed trades stats
  const closedTrades = trades.filter((t) => t.action === "sell" && t.realizedPnL !== undefined)
  const winningTrades = closedTrades.filter((t) => (t.realizedPnL || 0) > 0)
  const losingTrades = closedTrades.filter((t) => (t.realizedPnL || 0) <= 0)
  const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0
  const avgWin = winningTrades.length > 0
    ? winningTrades.reduce((s, t) => s + (t.realizedPnL || 0), 0) / winningTrades.length
    : 0
  const avgLoss = losingTrades.length > 0
    ? Math.abs(losingTrades.reduce((s, t) => s + (t.realizedPnL || 0), 0) / losingTrades.length)
    : 0
  const profitFactor = avgLoss > 0 ? avgWin / avgLoss : 0

  // Portfolio performance over time
  const snapshotData = snapshots.slice(-90).map((s) => ({
    date: format(parseISO(s.date), "MM/dd"),
    value: s.totalValue,
    sp500: s.sp500,
  }))

  // Holding periods
  const holdingStats = activePositions.map((p) => ({
    ticker: p.ticker,
    days: differenceInDays(new Date(), parseISO(p.entryDate)),
    pnl: ((p.currentPrice - p.avgCost) / p.avgCost) * 100,
  }))

  const longestHeld = holdingStats.sort((a, b) => b.days - a.days)[0]
  const bestTrade = activePositions.sort((a, b) => (b.currentPrice - b.avgCost) / b.avgCost - (a.currentPrice - a.avgCost) / a.avgCost)[0]
  const worstTrade = activePositions.sort((a, b) => (a.currentPrice - a.avgCost) / a.avgCost - (b.currentPrice - b.avgCost) / b.avgCost)[0]

  // P&L by position bar chart
  const pnlData = activePositions
    .map((p) => ({
      name: p.ticker,
      pnl: ((p.currentPrice - p.avgCost) / p.avgCost) * 100,
      value: p.shares * (p.currentPrice - p.avgCost),
    }))
    .sort((a, b) => b.pnl - a.pnl)

  // Goal tracking
  const targetValue = settings.startingCapital * 2
  const currentValue = stats?.totalValue || 0
  const goalProgress = Math.min((currentValue / targetValue) * 100, 100)
  const daysInvesting = differenceInDays(new Date(), parseISO(settings.inceptionDate))
  const projectedDays = goalProgress > 0 ? (daysInvesting / goalProgress) * 100 : 365

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Analytics</h1>

      {/* Key Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Active Positions</div>
          <div className="text-2xl font-bold text-white">{activePositions.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Holdings</div>
        </div>
        <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Win Rate</div>
          <div className="text-2xl font-bold text-white">{winRate.toFixed(0)}%</div>
          <div className="text-xs text-gray-500 mt-0.5">{closedTrades.length} closed trades</div>
        </div>
        <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Profit Factor</div>
          <div className="text-2xl font-bold text-white">{profitFactor > 0 ? profitFactor.toFixed(2) : "—"}</div>
          <div className="text-xs text-gray-500 mt-0.5">Win/Loss ratio</div>
        </div>
        <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Days Investing</div>
          <div className="text-2xl font-bold text-white">{daysInvesting}</div>
          <div className="text-xs text-gray-500 mt-0.5">Since inception</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Portfolio Performance Chart */}
        <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-4">Portfolio Value Over Time</div>
          {snapshotData.length > 1 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={snapshotData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1A2E52" />
                <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 10 }} />
                <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "#0C1628", border: "1px solid #1A2E52" }}
                  labelStyle={{ color: "#f9fafb" }}
                  formatter={(val: number) => [formatCurrency(val)]}
                />
                <Line type="monotone" dataKey="value" stroke="#00C2D4" strokeWidth={2} dot={false} name="Portfolio" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-600 text-sm">
              Track your portfolio over time to see performance chart
            </div>
          )}
        </div>

        {/* P&L by Position */}
        <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-4">P&L by Position (%)</div>
          {pnlData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={pnlData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1A2E52" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#9ca3af", fontSize: 11 }} width={45} />
                <Tooltip
                  contentStyle={{ background: "#0C1628", border: "1px solid #1A2E52" }}
                  formatter={(val: number) => [`${val.toFixed(2)}%`]}
                />
                <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
                  {pnlData.map((entry, i) => (
                    <Cell key={i} fill={entry.pnl >= 0 ? "#22c55e" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-600 text-sm">
              No positions to display
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trade Statistics */}
        <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-4">Trade Statistics</div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <TrendingUp className="w-4 h-4 text-green-400" />
                Avg Gain
              </div>
              <span className="text-green-400 font-medium">{avgWin > 0 ? formatCurrency(avgWin) : "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <TrendingDown className="w-4 h-4 text-red-400" />
                Avg Loss
              </div>
              <span className="text-red-400 font-medium">{avgLoss > 0 ? formatCurrency(-avgLoss) : "—"}</span>
            </div>
            <div className="flex items-center justify-between border-t border-[#1A2E52] pt-2">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Target className="w-4 h-4 text-[#00D8EE]" />
                Best Position
              </div>
              {bestTrade ? (
                <span className="text-green-400 font-medium text-sm">
                  {bestTrade.ticker} +{(((bestTrade.currentPrice - bestTrade.avgCost) / bestTrade.avgCost) * 100).toFixed(1)}%
                </span>
              ) : <span className="text-gray-500">—</span>}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <TrendingDown className="w-4 h-4 text-red-400" />
                Worst Position
              </div>
              {worstTrade ? (
                <span className="text-red-400 font-medium text-sm">
                  {worstTrade.ticker} {(((worstTrade.currentPrice - worstTrade.avgCost) / worstTrade.avgCost) * 100).toFixed(1)}%
                </span>
              ) : <span className="text-gray-500">—</span>}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <DollarSign className="w-4 h-4 text-yellow-400" />
                Longest Held
              </div>
              {longestHeld ? (
                <span className="text-yellow-400 font-medium text-sm">
                  {longestHeld.ticker} ({longestHeld.days}d)
                </span>
              ) : <span className="text-gray-500">—</span>}
            </div>
          </div>
        </div>

        {/* Goal Tracking */}
        <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-4">Goal Tracking</div>
          <div className="text-center mb-4">
            <div className="text-3xl font-bold text-white">{goalProgress.toFixed(1)}%</div>
            <div className="text-sm text-gray-400">toward 2x goal</div>
          </div>
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Current: {formatCurrency(currentValue)}</span>
              <span>Target: {formatCurrency(targetValue)}</span>
            </div>
            <div className="h-3 bg-[#1A2E52] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-[#00C2D4] transition-all duration-500"
                style={{ width: `${goalProgress}%` }}
              />
            </div>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">Starting capital</span>
              <span className="text-white">{formatCurrency(settings.startingCapital)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Monthly contribution</span>
              <span className="text-white">{formatCurrency(settings.monthlyContribution)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Est. completion</span>
              <span className="text-white">{Math.ceil(projectedDays / 365).toFixed(0)} years</span>
            </div>
          </div>
        </div>

        {/* Allocation Summary */}
        <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-4">Category Breakdown</div>
          {stats && (
            <div className="space-y-3">
              {Object.entries(stats.allocation)
                .filter(([, v]) => v > 0)
                .sort(([, a], [, b]) => b - a)
                .map(([cat, pct]) => {
                  const target = (settings.targetAllocation as Record<string, number>)[cat] || 0
                  const diff = pct - target
                  return (
                    <div key={cat}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400 capitalize">{cat}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-white">{pct.toFixed(1)}%</span>
                          {target > 0 && (
                            <span className={`text-xs ${Math.abs(diff) > 5 ? (diff > 0 ? "text-yellow-400" : "text-blue-400") : "text-gray-600"}`}>
                              (tgt {target}%)
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="h-1.5 bg-[#1A2E52] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-purple-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
