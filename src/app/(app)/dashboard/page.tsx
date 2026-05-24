"use client"

import { useEffect, useState, useCallback } from "react"
import { motion } from "framer-motion"
import { RefreshCw, TrendingUp, TrendingDown, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MetricCard, SkeletonCard } from "@/components/ui/MetricCard"
import { PriceChange, PercentBadge } from "@/components/ui/PriceChange"
import { usePortfolioStore } from "@/store/portfolioStore"
import { useAlertStore } from "@/store/alertStore"
import { getMultipleQuotes, getMarketNews, getEconomicCalendar, getUsdThbRate, getEarningsCalendar, getEarnings } from "@/lib/finnhub"
import { generateMarketBrief } from "@/lib/claude"
import type { Quote, NewsItem, EarningsCalendarItem } from "@/types"
import { format, addDays } from "date-fns"
import toast from "react-hot-toast"
import ReactMarkdown from "react-markdown"
import { HSRHeroBanner } from "@/components/hsr/HSRHeroBanner"
import { PAGE_CHARACTERS } from "@/components/hsr/characters"

const MARKET_SYMBOLS = ["SPY", "QQQ", "VIX"]

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n)
}
function formatTHB(n: number) {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

export default function DashboardPage() {
  const { positions, stats, settings, usdThbRate, lastUpdated, isDemoMode, setUsdThbRate, refreshStats, updateSettings } = usePortfolioStore()
  const { unreadCount, alerts, setPanelOpen } = useAlertStore()
  const swingSetups = alerts.flatMap(a => a.swingSetups || [])
  const character = PAGE_CHARACTERS.dashboard
  const [marketQuotes, setMarketQuotes] = useState<Record<string, Quote>>({})
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [aiBrief, setAiBrief] = useState<string>("")
  const [briefLoading, setBriefLoading] = useState(false)
  const [earnings, setEarnings] = useState<EarningsCalendarItem[]>([])
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    // Set initial time only on client to avoid hydration mismatch
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const refreshData = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const tickers = positions.filter((p) => p.isActive).map((p) => p.ticker)
      const allSymbols = [...new Set([...tickers, ...MARKET_SYMBOLS])]

      const quotes = await getMultipleQuotes(allSymbols)

      // Update position prices + persist to localStorage via setPositions
      const updatedPositions = positions.map((p) => {
        const q = quotes[p.ticker]
        return q ? { ...p, currentPrice: q.c } : p
      })
      // Use store setter (which calls savePositions) instead of raw setState
      // so the refreshed prices survive a page reload.
      usePortfolioStore.getState().setPositions(updatedPositions)

      setMarketQuotes(quotes)

      const rate = await getUsdThbRate()
      setUsdThbRate(rate)
      updateSettings({ totalCashTHB: settings.totalCashUSD * rate })

      // Load upcoming earnings (60 days window + per-ticker fallback for small caps)
      const from = format(new Date(), "yyyy-MM-dd")
      const to = format(addDays(new Date(), 60), "yyyy-MM-dd")
      const earningsData = await getEarningsCalendar(from, to)
      const myTickers = new Set(tickers)
      const fromBulk = earningsData.filter((e) => myTickers.has(e.symbol))
      const foundSymbols = new Set(fromBulk.map(e => e.symbol))
      const missing = tickers.filter(t => !foundSymbols.has(t))

      // Fallback: per-ticker fetch for ones missing from bulk (small caps often missing)
      let fromFallback: typeof fromBulk = []
      if (missing.length > 0) {
        const BATCH = 5
        for (let i = 0; i < missing.length; i += BATCH) {
          const batch = missing.slice(i, i + BATCH)
          const results = await Promise.allSettled(batch.map(t => getEarnings(t)))
          for (const r of results) {
            if (r.status === "fulfilled") {
              const upcoming = r.value.filter(e => new Date(e.date) >= new Date())
              fromFallback.push(...upcoming)
            }
          }
        }
      }

      const merged = [...fromBulk, ...fromFallback]
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 10)
      setEarnings(merged)

      toast.success("Data refreshed")
    } catch (err) {
      toast.error("Refresh failed: " + String(err))
    } finally {
      setIsRefreshing(false)
    }
  }, [positions, settings.totalCashUSD, refreshStats, setUsdThbRate, updateSettings])

  useEffect(() => {
    refreshData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function generateBrief() {
    setBriefLoading(true)
    try {
      const news = await getMarketNews()
      const events = await getEconomicCalendar()
      const brief = await generateMarketBrief(news, events, positions)
      setAiBrief(brief)
    } catch {
      setAiBrief("Unable to generate brief. Check API key in Settings.")
    } finally {
      setBriefLoading(false)
    }
  }

  const activePositions = positions.filter((p) => p.isActive && p.category !== "watchlist")
  const gainers = [...activePositions]
    .filter((p) => p.currentPrice > p.avgCost)
    .sort((a, b) => (b.currentPrice / b.avgCost - b.avgCost / b.avgCost) - (a.currentPrice / a.avgCost - a.avgCost / a.avgCost))
    .slice(0, 3)
  const losers = [...activePositions]
    .filter((p) => p.currentPrice < p.avgCost)
    .sort((a, b) => (a.currentPrice / a.avgCost) - (b.currentPrice / b.avgCost))
    .slice(0, 3)

  const spy = marketQuotes["SPY"]
  const qqq = marketQuotes["QQQ"]
  const vix = marketQuotes["VIX"]

  const vixLevel = vix?.c || 0
  const vixColor = vixLevel < 15 ? "text-green-400" : vixLevel < 25 ? "text-yellow-400" : "text-red-400"

  // Heatmap
  const heatmapPositions = activePositions.map((p) => {
    const pnlPct = ((p.currentPrice - p.avgCost) / p.avgCost) * 100
    const weight = stats ? (p.shares * p.currentPrice) / stats.totalValue : 0
    let bg = "#1A2E52"
    if (pnlPct > 3) bg = "#166534"
    else if (pnlPct > 1) bg = "#15803d"
    else if (pnlPct > 0) bg = "#166534aa"
    else if (pnlPct > -1) bg = "#7f1d1d99"
    else if (pnlPct > -3) bg = "#991b1b"
    else bg = "#7f1d1d"
    return { ...p, pnlPct, weight, bg }
  })

  const alphaScore = stats?.alphaScore ?? 0

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      {/* ── HSR Hero Banner ─────────────────────────── */}
      <HSRHeroBanner character={character} title={settings.portfolioName}>
        <div className="mb-1 flex items-center gap-2">
          <span className="text-[10px] tracking-[0.2em] uppercase font-semibold" style={{ color: character.color }}>
            {character.role}
          </span>
          {isDemoMode && (
            <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded border border-yellow-500/30">DEMO</span>
          )}
        </div>
        <h1 className="text-3xl font-bold text-white mb-1">{settings.portfolioName}</h1>
        <div className="text-sm text-gray-400 mb-3" suppressHydrationWarning>
          {now ? format(now, "EEEE, d MMM yyyy • HH:mm:ss") : "—"}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {stats && (
            <div className="flex items-center gap-1.5 bg-black/30 rounded-lg px-3 py-1.5 border border-white/5">
              <span className="text-xs text-gray-400">Portfolio</span>
              <span className="text-sm font-bold text-white">{formatCurrency(stats.totalValue)}</span>
              <span className={`text-xs font-medium ${stats.totalPnLPercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {stats.totalPnLPercent >= 0 ? "▲" : "▼"}{Math.abs(stats.totalPnLPercent).toFixed(2)}%
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5 bg-black/30 rounded-lg px-3 py-1.5 border border-yellow-500/20">
            <span className="text-xs text-gray-400">THB</span>
            <span className="text-sm font-bold text-yellow-400">{usdThbRate.toFixed(2)}</span>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={() => setPanelOpen(true)}
              className="flex items-center gap-1.5 bg-black/30 rounded-lg px-3 py-1.5 border border-[#00C2D4]/30 text-[#00D8EE] hover:bg-[#00C2D4]/10 transition-colors"
            >
              <span className="text-xs">{unreadCount} alert{unreadCount > 1 ? "s" : ""}</span>
              {swingSetups.length > 0 && (
                <span className="text-[10px] bg-[#00C2D4]/20 px-1.5 rounded">
                  {swingSetups.length} swing
                </span>
              )}
            </button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={refreshData}
            disabled={isRefreshing}
            className="border-[#1F3566] text-gray-300 hover:bg-[#1A2E52] bg-black/30 text-xs py-1"
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </HSRHeroBanner>

      {/* Hero Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {stats ? (
          <>
            <MetricCard
              label="Total Portfolio Value"
              value={formatCurrency(stats.totalValue)}
              subValue={formatTHB(stats.totalValueTHB)}
              gradient
            />
            <MetricCard
              label="Today's P&L"
              value={<PriceChange value={stats.todayPnL} size="lg" />}
              subValue={`${stats.todayPnLPercent >= 0 ? "+" : ""}${stats.todayPnLPercent.toFixed(2)}%`}
            />
            <MetricCard
              label="Total Return"
              value={<PriceChange value={stats.totalPnL} size="lg" />}
              subValue={`${stats.totalPnLPercent >= 0 ? "+" : ""}${stats.totalPnLPercent.toFixed(2)}%`}
            />
            <MetricCard
              label="Alpha Score"
              value={
                <span className="text-[#00D8EE] text-2xl font-bold">{alphaScore}</span>
              }
              subValue={alphaScore >= 75 ? "⭐ Professional Grade" : alphaScore >= 60 ? "✅ Solid Investor" : "⚠️ Needs Improvement"}
              badge={
                <div className="text-xs bg-[#00C2D4]/20 text-[#00D8EE] px-2 py-0.5 rounded">
                  /100
                </div>
              }
            />
          </>
        ) : (
          Array(4).fill(0).map((_, i) => <SkeletonCard key={i} />)
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Portfolio Heatmap */}
        <div className="lg:col-span-2 bg-[#0C1628] border border-[#1A2E52] rounded-xl p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-3">Portfolio Heatmap</div>
          <div className="flex flex-wrap gap-2">
            {heatmapPositions.map((p) => (
              <div
                key={p.id}
                style={{
                  backgroundColor: p.bg,
                  width: `${Math.max(p.weight * 400, 60)}px`,
                  minWidth: "60px",
                }}
                className="rounded-lg p-2 cursor-pointer hover:opacity-80 transition-opacity"
                title={`${p.ticker}: ${p.pnlPct.toFixed(2)}%`}
              >
                <div className="text-xs font-bold text-white">{p.ticker}</div>
                <div className={`text-xs ${p.pnlPct >= 0 ? "text-green-300" : "text-red-300"}`}>
                  {p.pnlPct >= 0 ? "+" : ""}{p.pnlPct.toFixed(1)}%
                </div>
              </div>
            ))}
            {activePositions.length === 0 && (
              <div className="text-gray-500 text-sm py-4">No positions yet. Add positions in Portfolio.</div>
            )}
          </div>
        </div>

        {/* Top Movers */}
        <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-3">Top Movers Today</div>
          {gainers.length > 0 && (
            <div className="mb-3">
              <div className="text-xs text-gray-600 mb-2 flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-green-400" /> Gainers
              </div>
              {gainers.map((p) => {
                const pct = ((p.currentPrice - p.avgCost) / p.avgCost) * 100
                return (
                  <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-[#1A2E52] last:border-0">
                    <div>
                      <div className="text-sm font-medium text-white">{p.ticker}</div>
                      <div className="text-xs text-gray-500">${p.currentPrice.toFixed(2)}</div>
                    </div>
                    <PercentBadge value={pct} />
                  </div>
                )
              })}
            </div>
          )}
          {losers.length > 0 && (
            <div>
              <div className="text-xs text-gray-600 mb-2 flex items-center gap-1">
                <TrendingDown className="w-3 h-3 text-red-400" /> Losers
              </div>
              {losers.map((p) => {
                const pct = ((p.currentPrice - p.avgCost) / p.avgCost) * 100
                return (
                  <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-[#1A2E52] last:border-0">
                    <div>
                      <div className="text-sm font-medium text-white">{p.ticker}</div>
                      <div className="text-xs text-gray-500">${p.currentPrice.toFixed(2)}</div>
                    </div>
                    <PercentBadge value={pct} />
                  </div>
                )
              })}
            </div>
          )}
          {gainers.length === 0 && losers.length === 0 && (
            <div className="text-gray-500 text-sm py-4 text-center">No positions to display</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Daily Brief */}
        <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#00D8EE]" />
              <span className="text-xs text-gray-500 uppercase tracking-wide">AI Daily Brief</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={generateBrief}
              disabled={briefLoading}
              className="text-xs text-[#00D8EE] hover:text-[#80ECF8]"
            >
              {briefLoading ? "Generating..." : "Generate"}
            </Button>
          </div>
          {aiBrief ? (
            <div className="prose prose-sm prose-invert max-w-none text-gray-300 text-sm">
              <ReactMarkdown>{aiBrief}</ReactMarkdown>
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="text-gray-500 text-sm mb-3">
                Get a personalized morning briefing for your portfolio
              </div>
              <Button
                size="sm"
                onClick={generateBrief}
                disabled={briefLoading}
                className="bg-[#00C2D4] hover:bg-[#00A8BC] text-white text-xs"
              >
                {briefLoading ? "Generating..." : "Generate Brief"}
              </Button>
            </div>
          )}
        </div>

        {/* Upcoming Events */}
        <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-3">Upcoming Earnings</div>
          {earnings.length > 0 ? (
            <div className="space-y-2">
              {earnings.slice(0, 6).map((e, i) => {
                const daysUntil = Math.ceil(
                  (new Date(e.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                )
                return (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-[#1A2E52] last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{e.symbol}</span>
                      <span className="text-xs text-gray-500">Q{e.quarter} {e.year}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{e.date}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        daysUntil <= 3 ? "bg-red-500/20 text-red-400" :
                        daysUntil <= 7 ? "bg-yellow-500/20 text-yellow-400" :
                        "bg-gray-500/20 text-gray-400"
                      }`}>
                        {daysUntil}d
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-gray-500 text-sm py-4 text-center">
              No upcoming earnings for holdings
            </div>
          )}
        </div>
      </div>

      {/* Portfolio Summary */}
      {stats && (
        <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">Cash Available</div>
            <div className="text-lg font-bold text-white">{formatCurrency(stats.cashUSD)}</div>
            <div className="text-xs text-gray-400">{((stats.cashUSD / stats.totalValue) * 100).toFixed(1)}% of portfolio</div>
          </div>
          <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">Positions</div>
            <div className="text-lg font-bold text-white">{activePositions.length}</div>
            <div className="text-xs text-gray-400">Active holdings</div>
          </div>
          <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">Best Performer</div>
            {gainers[0] ? (
              <>
                <div className="text-lg font-bold text-green-400">{gainers[0].ticker}</div>
                <div className="text-xs text-gray-400">
                  +{(((gainers[0].currentPrice - gainers[0].avgCost) / gainers[0].avgCost) * 100).toFixed(1)}%
                </div>
              </>
            ) : (
              <div className="text-lg font-bold text-gray-500">–</div>
            )}
          </div>
          <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">In THB</div>
            <div className="text-lg font-bold text-yellow-400">{formatTHB(stats.totalValueTHB)}</div>
            <div className="text-xs text-gray-400">@ {usdThbRate.toFixed(2)} rate</div>
          </div>
        </div>
      )}
    </div>
  )
}
