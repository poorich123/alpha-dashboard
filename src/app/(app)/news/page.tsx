"use client"

import { useState, useEffect, useCallback } from "react"
import { RefreshCw, ExternalLink, Calendar, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, AlertTriangle, Activity } from "lucide-react"
import { Button } from "@/components/ui/button"
import { usePortfolioStore } from "@/store/portfolioStore"
import { getMarketNews, getNews, getEarningsCalendar, getEarnings, getEconomicCalendar } from "@/lib/finnhub"
import { quickScoreSentiment, quickScoreImpact } from "@/lib/newsMonitor"
import { detectMacroRisks, type MacroSnapshot } from "@/lib/macroRisk"
import { getUSEconomicEvents } from "@/lib/usEconomicSchedule"
import type { NewsItem, EarningsCalendarItem, EconomicEvent } from "@/types"
import { format, addDays, formatDistanceToNow, parseISO } from "date-fns"
import { InlineSpinner } from "@/components/ui/LoadingSpinner"
import toast from "react-hot-toast"
import { cn } from "@/lib/utils"

// Keywords used by Macro tab to filter macro-relevant news from general feed
const MACRO_KEYWORDS = [
  "fed", "fomc", "powell", "rate cut", "rate hike", "interest rate",
  "cpi", "ppi", "pce", "inflation", "deflation",
  "gdp", "nfp", "payroll", "unemployment", "jobless",
  "recession", "yield", "treasury", "bond market", "10-year",
  "trump", "tariff", "china trade", "trade war",
  "oil", "opec", "brent", "crude", "saudi", "iran", "russia",
  "vix", "volatility", "dollar index", "dxy",
  "earnings season", "fiscal", "stimulus", "debt ceiling",
]

function isMacroNews(n: NewsItem): boolean {
  const hay = `${n.headline} ${n.summary || ""}`.toLowerCase()
  return MACRO_KEYWORDS.some(kw => hay.includes(kw))
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

type Filter = "all" | "holdings" | "macro" | "earnings"

export default function NewsPage() {
  const { positions } = usePortfolioStore()
  const [filter, setFilter] = useState<Filter>("all")
  const [news, setNews] = useState<NewsItem[]>([])
  const [holdingNewsByTicker, setHoldingNewsByTicker] = useState<Record<string, NewsItem[]>>({})
  const [earnings, setEarnings] = useState<EarningsCalendarItem[]>([])
  const [economic, setEconomic] = useState<EconomicEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedTickers, setExpandedTickers] = useState<Record<string, boolean>>({})
  const [macroSnap, setMacroSnap] = useState<MacroSnapshot | null>(null)
  const [loadingMacro, setLoadingMacro] = useState(false)

  const tickers = positions.filter((p) => p.isActive && p.category !== "watchlist").map((p) => p.ticker)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const from = format(new Date(), "yyyy-MM-dd")
      const to = format(addDays(new Date(), 60), "yyyy-MM-dd")

      // Independent sources — one failing must NOT take down the others.
      // Finnhub's economic calendar is a premium endpoint (403 on free tier),
      // so we fall back silently to the local US schedule below.
      const [marketRes, earningsRes, econRes] = await Promise.allSettled([
        getMarketNews(),
        getEarningsCalendar(from, to),
        getEconomicCalendar(),
      ])

      const marketNews = marketRes.status === "fulfilled" ? marketRes.value : []
      const earningsData = earningsRes.status === "fulfilled" ? earningsRes.value : []
      const econData = econRes.status === "fulfilled" ? econRes.value : []

      setNews(marketNews.slice(0, 50))
      if (marketRes.status === "rejected") {
        toast.error("ข่าวตลาดโหลดไม่ได้: " + String(marketRes.reason))
      }

      // Merge Finnhub's intl events with US schedule (Finnhub free tier
      // doesn't return major US events like PCE/CPI/NFP/FOMC, and the calendar
      // endpoint itself is premium — econData is [] on free tier).
      const usEvents = getUSEconomicEvents(new Date(), addDays(new Date(), 60))
      setEconomic([...econData, ...usEvents])

      // Per-ticker fallback for holdings that didn't appear in bulk (small caps)
      let mergedEarnings = earningsData
      if (tickers.length > 0) {
        const myTickerSet = new Set(tickers)
        const foundInBulk = new Set(
          earningsData.filter(e => myTickerSet.has(e.symbol)).map(e => e.symbol)
        )
        const missing = tickers.filter(t => !foundInBulk.has(t))
        // Throttled: small batches + delay so the Finnhub free-tier rate limit
        // isn't tripped (a burst returns 429 → every ticker shows 0 results).
        const BATCH = 4
        for (let i = 0; i < missing.length; i += BATCH) {
          const batch = missing.slice(i, i + BATCH)
          const results = await Promise.allSettled(batch.map(t => getEarnings(t)))
          for (const r of results) {
            if (r.status === "fulfilled") {
              const upcoming = r.value.filter(e => new Date(e.date) >= new Date())
              mergedEarnings = [...mergedEarnings, ...upcoming]
            }
          }
          if (i + BATCH < missing.length) await sleep(350)
        }
      }
      setEarnings(mergedEarnings)

      // ── Fetch news for ALL holdings — throttled (batch 3 + delay) so we don't
      //    hit Finnhub's rate limit; update the UI after each batch so partial
      //    results render even if a later batch fails. ──
      if (tickers.length > 0) {
        const byTicker: Record<string, NewsItem[]> = {}
        // Auto-expand first 3 tickers up front
        const auto: Record<string, boolean> = {}
        tickers.slice(0, 3).forEach(t => { auto[t] = true })
        setExpandedTickers(auto)

        const BATCH = 3
        for (let i = 0; i < tickers.length; i += BATCH) {
          const batch = tickers.slice(i, i + BATCH)
          const results = await Promise.allSettled(batch.map(t => getNews(t)))
          batch.forEach((t, idx) => {
            const res = results[idx]
            if (res.status === "fulfilled") {
              byTicker[t] = (res.value || []).slice(0, 8) // limit 8 per ticker
            }
          })
          setHoldingNewsByTicker({ ...byTicker })  // progressive render
          if (i + BATCH < tickers.length) await sleep(450)
        }
      }
    } catch (err) {
      toast.error("Failed to load news: " + String(err))
    } finally {
      setLoading(false)
    }
  }, [tickers])

  useEffect(() => {
    loadData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Lazy-load macro snapshot when Macro tab opens + auto-refresh every 5 min
  useEffect(() => {
    if (filter !== "macro") return

    const fetchSnap = () => {
      setLoadingMacro(true)
      detectMacroRisks()
        .then(setMacroSnap)
        .catch(() => toast.error("Failed to load macro risks"))
        .finally(() => setLoadingMacro(false))
    }

    // Fetch immediately if we don't have data, or it's stale (>5 min old)
    const isStale = !macroSnap || Date.now() - macroSnap.scannedAt > 5 * 60 * 1000
    if (isStale && !loadingMacro) fetchSnap()

    // Refresh every 5 minutes while on Macro tab
    const id = setInterval(fetchSnap, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [filter]) // eslint-disable-line react-hooks/exhaustive-deps

  const myTickerSet = new Set(tickers)

  const filteredNews = news.filter((n) => {
    if (filter === "holdings") {
      return tickers.some((t) => n.related?.includes(t) || n.headline.includes(t))
    }
    if (filter === "macro") {
      return isMacroNews(n)
    }
    return true
  })

  // Dedupe + sort upcoming earnings by date
  const dedupedEarnings = Array.from(
    new Map(earnings.map(e => [`${e.symbol}-${e.date}`, e])).values()
  ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const myEarnings = dedupedEarnings.filter((e) => myTickerSet.has(e.symbol))
  const allEarnings = dedupedEarnings.filter((e) => !myTickerSet.has(e.symbol)).slice(0, 30)

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">News & Events</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          disabled={loading}
          className="border-[#1F3566] text-gray-300 hover:bg-[#1A2E52]"
        >
          {loading ? <InlineSpinner className="mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
          Refresh
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(["all", "holdings", "macro", "earnings"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? "bg-[#00C2D4] text-white"
                : "bg-[#0C1628] border border-[#1A2E52] text-gray-400 hover:text-white"
            }`}
          >
            {f === "all" ? "All News" : f === "holdings" ? "My Holdings" : f === "macro" ? "Macro" : "Earnings"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* News Feed */}
        <div className="lg:col-span-2 space-y-3">
          {filter === "holdings" ? (
            <HoldingsNewsByTicker
              tickers={tickers}
              newsByTicker={holdingNewsByTicker}
              loading={loading}
              expanded={expandedTickers}
              setExpanded={setExpandedTickers}
            />
          ) : filter === "earnings" ? (
            <EarningsCalendarMain
              earnings={dedupedEarnings}
              myTickerSet={myTickerSet}
              loading={loading}
            />
          ) : filter === "macro" ? (
            <MacroDashboard
              snapshot={macroSnap}
              loadingSnap={loadingMacro}
              economic={economic}
              macroNews={news.filter(isMacroNews)}
            />
          ) : (
            <>
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-3">
            {filteredNews.length} articles
          </div>
          {loading && filteredNews.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <InlineSpinner className="text-[#00D8EE] w-6 h-6" />
              <span className="ml-2 text-gray-400">Loading news...</span>
            </div>
          ) : filteredNews.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No news available</div>
          ) : (
            filteredNews.map((article) => {
              const relatedTickers = tickers.filter(
                (t) => article.related?.includes(t) || article.headline.includes(t)
              )
              const ageStr = formatDistanceToNow(new Date(article.datetime * 1000), { addSuffix: true })

              return (
                <a
                  key={article.id}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block bg-[#0C1628] border border-[#1A2E52] rounded-xl p-4 hover:border-[#00C2D4]/50 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-xs text-gray-500">{article.source}</span>
                        <span className="text-xs text-gray-600">•</span>
                        <span className="text-xs text-gray-500">{ageStr}</span>
                        {relatedTickers.map((t) => (
                          <span key={t} className="text-xs bg-[#00C2D4]/20 text-[#00D8EE] px-1.5 py-0.5 rounded">
                            {t}
                          </span>
                        ))}
                      </div>
                      <div className="text-sm font-medium text-white group-hover:text-[#80ECF8] transition-colors line-clamp-2">
                        {article.headline}
                      </div>
                      {article.summary && (
                        <div className="text-xs text-gray-500 mt-1.5 line-clamp-2">{article.summary}</div>
                      )}
                    </div>
                    {article.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={article.image}
                        alt=""
                        className="w-16 h-12 object-cover rounded flex-shrink-0"
                        onError={(e) => (e.currentTarget.style.display = "none")}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-xs text-[#00C2D4] opacity-0 group-hover:opacity-100 transition-opacity">
                    <ExternalLink className="w-3 h-3" /> Read full article
                  </div>
                </a>
              )
            })
          )}
            </>
          )}
        </div>

        {/* Sidebar - Calendars */}
        <div className="space-y-4">
          {/* My Holdings Earnings */}
          {myEarnings.length > 0 && (
            <div className="bg-[#0C1628] border border-[#00C2D4]/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-[#00D8EE]" />
                <span className="text-xs text-gray-500 uppercase tracking-wide">My Holdings Earnings</span>
              </div>
              <div className="space-y-2">
                {myEarnings.map((e, i) => {
                  const daysUntil = Math.ceil(
                    (new Date(e.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                  )
                  return (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-[#1A2E52] last:border-0">
                      <div>
                        <div className="text-sm font-bold text-white">{e.symbol}</div>
                        <div className="text-xs text-gray-500">Q{e.quarter} • {e.hour || "AMC"}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-400">{e.date}</div>
                        <div className={`text-xs px-1.5 py-0.5 rounded inline-block ${
                          daysUntil <= 3 ? "bg-red-500/20 text-red-400" :
                          daysUntil <= 7 ? "bg-yellow-500/20 text-yellow-400" :
                          "bg-gray-500/20 text-gray-400"
                        }`}>
                          {daysUntil}d
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Economic Calendar */}
          <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-yellow-400" />
              <span className="text-xs text-gray-500 uppercase tracking-wide">Economic Calendar</span>
            </div>
            {economic.length > 0 ? (
              <div className="space-y-2">
                {economic.slice(0, 10).map((e, i) => {
                  const isHighImpact = e.impact === "high" || e.impact === "3"
                  return (
                    <div key={i} className="flex items-start justify-between py-1.5 border-b border-[#1A2E52] last:border-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {isHighImpact && <span className="text-red-400 text-xs">🔴</span>}
                          <span className="text-xs font-medium text-white truncate">{e.event}</span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {e.time?.slice(0, 10)} • {e.country}
                        </div>
                        <div className="text-xs text-gray-600 mt-0.5">
                          Prev: {e.prev} | Est: {e.estimate} {e.unit}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-gray-500 text-xs text-center py-4">No upcoming events</div>
            )}
          </div>

          {/* Upcoming Earnings (all) */}
          {allEarnings.length > 0 && (
            <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-4">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-3">Other Earnings</div>
              <div className="space-y-1.5">
                {allEarnings.slice(0, 8).map((e, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-gray-400 font-mono">{e.symbol}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">{e.date}</span>
                      {e.epsEstimate && (
                        <span className="text-gray-500">Est ${e.epsEstimate}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Macro Dashboard — Main Content (Macro tab) ─────────────────────────────
//
// 3 sections: Risk snapshot → Economic Calendar (full) → Macro News (keyword)
//
interface MacroDashboardProps {
  snapshot: MacroSnapshot | null
  loadingSnap: boolean
  economic: EconomicEvent[]
  macroNews: NewsItem[]
}

type EconTF = "today" | "week" | "month" | "all"
const TF_LABELS: Record<EconTF, string> = {
  today: "Today",
  week:  "This Week",
  month: "This Month",
  all:   "All",
}

function MacroDashboard({ snapshot, loadingSnap, economic, macroNews }: MacroDashboardProps) {
  const [econTF, setEconTF] = useState<EconTF>("week")

  const riskColor = (lv: string) =>
    lv === "EXTREME" ? "bg-red-500/20 text-red-300 border-red-500/40" :
    lv === "HIGH"    ? "bg-orange-500/20 text-orange-300 border-orange-500/40" :
    lv === "MEDIUM"  ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/40" :
                       "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"

  // Filter by timeframe (event time is ISO-like; parseable by Date)
  const now = new Date()
  const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999)
  // "This Week" = next 7 days from now (rolling window, not ISO calendar week)
  const endOfWeek = new Date(now); endOfWeek.setDate(now.getDate() + 7)
  // "This Month" = next 30 days from now (rolling window)
  const endOfMonth = new Date(now); endOfMonth.setDate(now.getDate() + 30)

  const inTF = (ev: EconomicEvent): boolean => {
    if (econTF === "all" || !ev.time) return true
    const t = new Date(ev.time).getTime()
    if (isNaN(t)) return true
    if (t < now.getTime() - 24 * 60 * 60 * 1000) return false // skip events older than yesterday
    if (econTF === "today") return t <= endOfToday.getTime()
    if (econTF === "week")  return t <= endOfWeek.getTime()
    if (econTF === "month") return t <= endOfMonth.getTime()
    return true
  }

  // Filter by timeframe → then high-impact first, then by time
  const filteredEvents = economic.filter(inTF)
  const sortedEvents = [...filteredEvents].sort((a, b) => {
    const aImp = a.impact === "high" || a.impact === "3" ? 0 : a.impact === "medium" || a.impact === "2" ? 1 : 2
    const bImp = b.impact === "high" || b.impact === "3" ? 0 : b.impact === "medium" || b.impact === "2" ? 1 : 2
    if (aImp !== bImp) return aImp - bImp
    return (a.time || "").localeCompare(b.time || "")
  }).slice(0, 30)

  // Count per timeframe (for chip labels)
  const tfCounts = (Object.keys(TF_LABELS) as EconTF[]).reduce((acc, tf) => {
    if (tf === "all") {
      acc[tf] = economic.length
    } else {
      acc[tf] = economic.filter(ev => {
        if (!ev.time) return false
        const t = new Date(ev.time).getTime()
        if (isNaN(t) || t < now.getTime() - 24 * 60 * 60 * 1000) return false
        if (tf === "today") return t <= endOfToday.getTime()
        if (tf === "week")  return t <= endOfWeek.getTime()
        if (tf === "month") return t <= endOfMonth.getTime()
        return false
      }).length
    }
    return acc
  }, {} as Record<EconTF, number>)

  return (
    <div className="space-y-4">
      {/* ── Macro Risk Snapshot ─────────────────────────────────── */}
      {loadingSnap && !snapshot ? (
        <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-6 flex items-center justify-center">
          <InlineSpinner className="text-[#00D8EE] w-5 h-5" />
          <span className="ml-2 text-gray-400 text-sm">Scanning macro indicators…</span>
        </div>
      ) : snapshot ? (
        <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl overflow-hidden">
          <div className="bg-[#0A1424] border-b border-[#1A2E52] px-4 py-3 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Activity className={cn("w-4 h-4 text-[#00D8EE]", loadingSnap && "animate-pulse")} />
              <span className="text-sm font-semibold text-white">Macro Risk Snapshot</span>
              <span className="text-[10px] text-gray-600">
                · Auto-refresh 5m · Updated {formatDistanceToNow(snapshot.scannedAt, { addSuffix: true })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Overall:</span>
              <span className={cn("text-xs font-bold px-2 py-0.5 rounded border", riskColor(snapshot.overallRisk))}>
                {snapshot.overallRisk}
              </span>
              <span className="text-xs text-gray-500">· Score {snapshot.riskScore}/100</span>
            </div>
          </div>
          <div className="p-4">
            {snapshot.topConcern && (
              <div className="mb-3 flex items-start gap-2 bg-[#1A2E52]/40 border border-[#1A2E52] rounded-lg p-2.5">
                <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-yellow-100">
                  <span className="text-gray-500 mr-1">Top concern:</span>
                  {snapshot.topConcern}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {snapshot.factors.slice(0, 6).map(f => (
                <div key={f.id} className="bg-[#070B18] border border-[#1A2E52]/60 rounded-lg p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{f.emoji}</span>
                      <span className="text-xs font-medium text-white truncate">{f.label}</span>
                    </div>
                    <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border", riskColor(f.level))}>
                      {f.level}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-500 line-clamp-2">{f.signal}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Economic Calendar (full) ─────────────────────────────── */}
      <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl overflow-hidden">
        <div className="bg-[#0A1424] border-b border-[#1A2E52] px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-semibold text-white">Economic Calendar</span>
            <span className="text-[10px] text-gray-500">· high-impact first</span>
          </div>
          {/* Timeframe filter chips */}
          <div className="flex items-center gap-1">
            {(Object.keys(TF_LABELS) as EconTF[]).map(tf => {
              const active = econTF === tf
              const count = tfCounts[tf]
              return (
                <button
                  key={tf}
                  onClick={() => setEconTF(tf)}
                  disabled={count === 0 && !active}
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-semibold transition-colors",
                    active
                      ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/40"
                      : count > 0
                      ? "text-gray-400 hover:text-white border border-transparent"
                      : "text-gray-700 border border-transparent cursor-not-allowed",
                  )}
                >
                  {TF_LABELS[tf]} <span className="text-[9px] opacity-70">({count})</span>
                </button>
              )
            })}
          </div>
        </div>
        {sortedEvents.length === 0 ? (
          <div className="text-center py-6 text-gray-500 text-sm">No upcoming events</div>
        ) : (
          <div className="divide-y divide-[#1A2E52]/60">
            {sortedEvents.map((e, i) => {
              const isHigh = e.impact === "high" || e.impact === "3"
              const isMed  = e.impact === "medium" || e.impact === "2"
              return (
                <div key={i} className="px-4 py-2.5 flex items-center justify-between hover:bg-[#1A2E52]/30">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className={cn(
                      "w-2 h-2 rounded-full flex-shrink-0",
                      isHigh ? "bg-red-500" : isMed ? "bg-yellow-500" : "bg-gray-600"
                    )} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-white truncate">{e.event}</div>
                      <div className="text-[10px] text-gray-500">
                        {e.time?.slice(0, 16)} · {e.country}
                        {e.prev !== undefined && <span> · Prev: {e.prev}</span>}
                        {e.estimate !== undefined && <span> · Est: {e.estimate}</span>}
                        {e.unit && <span> {e.unit}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Macro News (keyword-filtered) ────────────────────────── */}
      <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl overflow-hidden">
        <div className="bg-[#0A1424] border-b border-[#1A2E52] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-semibold text-white">Macro News</span>
          </div>
          <span className="text-[10px] text-gray-500">{macroNews.length} articles · Fed/CPI/oil/war keywords</span>
        </div>
        {macroNews.length === 0 ? (
          <div className="text-center py-6 text-gray-500 text-sm">
            No macro-relevant headlines in current news feed
          </div>
        ) : (
          <div className="divide-y divide-[#1A2E52]/60">
            {macroNews.slice(0, 20).map(article => {
              const ageStr = formatDistanceToNow(new Date(article.datetime * 1000), { addSuffix: true })
              return (
                <a
                  key={article.id}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-4 py-3 hover:bg-[#1A2E52]/30 transition-colors group"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] text-gray-500">{article.source}</span>
                    <span className="text-[10px] text-gray-700">· {ageStr}</span>
                  </div>
                  <div className="text-xs font-medium text-white group-hover:text-cyan-300 line-clamp-2 leading-snug">
                    {article.headline}
                  </div>
                </a>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Earnings Calendar — Main Content (Earnings tab) ────────────────────────
//
// Groups upcoming earnings by week, highlights "my holdings" rows.
// Pulls from full 60-day window + per-ticker fallback (loaded on mount).
//
interface EarningsCalendarProps {
  earnings: EarningsCalendarItem[]
  myTickerSet: Set<string>
  loading: boolean
}

function EarningsCalendarMain({ earnings, myTickerSet, loading }: EarningsCalendarProps) {
  if (loading && earnings.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <InlineSpinner className="text-[#00D8EE] w-6 h-6" />
        <span className="ml-2 text-gray-400">Loading earnings calendar…</span>
      </div>
    )
  }

  // Only upcoming earnings
  const now = Date.now()
  const upcoming = earnings.filter(e => new Date(e.date).getTime() >= now - 24 * 60 * 60 * 1000)

  if (upcoming.length === 0) {
    return <div className="text-center py-12 text-gray-500">No upcoming earnings in the next 60 days</div>
  }

  // Group by ISO week (YYYY-Www)
  const byWeek: Record<string, EarningsCalendarItem[]> = {}
  for (const e of upcoming) {
    const d = new Date(e.date)
    // Week start = Monday
    const monday = new Date(d)
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    const key = format(monday, "yyyy-MM-dd")
    if (!byWeek[key]) byWeek[key] = []
    byWeek[key].push(e)
  }

  const weeks = Object.keys(byWeek).sort()

  return (
    <div className="space-y-4">
      <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">
        {upcoming.length} upcoming earnings · next 60 days · sorted by week
      </div>

      {weeks.map(weekKey => {
        const weekStart = new Date(weekKey)
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekStart.getDate() + 6)
        const items = byWeek[weekKey]

        return (
          <div key={weekKey} className="bg-[#0C1628] border border-[#1A2E52] rounded-xl overflow-hidden">
            <div className="bg-[#0A1424] border-b border-[#1A2E52] px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#00D8EE]" />
                <span className="text-sm font-semibold text-white">
                  Week of {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d")}
                </span>
              </div>
              <span className="text-[10px] text-gray-500">{items.length} reports</span>
            </div>

            <div className="divide-y divide-[#1A2E52]/60">
              {items.map((e, i) => {
                const isHolding = myTickerSet.has(e.symbol)
                const daysUntil = Math.ceil((new Date(e.date).getTime() - now) / (1000 * 60 * 60 * 24))

                return (
                  <div
                    key={`${e.symbol}-${e.date}-${i}`}
                    className={cn(
                      "px-4 py-2.5 flex items-center justify-between hover:bg-[#1A2E52]/30 transition-colors",
                      isHolding && "bg-[#00C2D4]/[0.04] border-l-2 border-l-[#00C2D4]/60"
                    )}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="text-sm font-bold text-white w-16 flex-shrink-0">{e.symbol}</div>
                      {isHolding && (
                        <span className="text-[9px] font-bold bg-[#00C2D4]/20 text-[#00D8EE] px-1.5 py-0.5 rounded border border-[#00C2D4]/40">
                          HOLDING
                        </span>
                      )}
                      <div className="text-xs text-gray-500">
                        Q{e.quarter} {e.year} · {e.hour || "AMC"}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      {e.epsEstimate != null && (
                        <span className="text-[10px] text-gray-500">
                          Est ${e.epsEstimate}
                        </span>
                      )}
                      <span className="text-xs text-gray-400 font-mono w-20 text-right">{e.date}</span>
                      <span className={cn(
                        "text-[10px] font-semibold px-1.5 py-0.5 rounded w-10 text-center",
                        daysUntil <= 3 ? "bg-red-500/20 text-red-400" :
                        daysUntil <= 7 ? "bg-yellow-500/20 text-yellow-400" :
                        "bg-gray-500/20 text-gray-400"
                      )}>
                        {daysUntil}d
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Holdings News By Ticker (Q3 + Q4 fix) ──────────────────────────────────
//
// แสดงข่าวแยกตาม ticker · กดได้พับ-เปิด · มี sentiment ต่อข่าว (good/bad/neutral)
//
interface HoldingsNewsProps {
  tickers: string[]
  newsByTicker: Record<string, NewsItem[]>
  loading: boolean
  expanded: Record<string, boolean>
  setExpanded: (e: Record<string, boolean>) => void
}

function HoldingsNewsByTicker({ tickers, newsByTicker, loading, expanded, setExpanded }: HoldingsNewsProps) {
  if (loading && Object.keys(newsByTicker).length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <InlineSpinner className="text-[#00D8EE] w-6 h-6" />
        <span className="ml-2 text-gray-400">Loading news for {tickers.length} tickers...</span>
      </div>
    )
  }

  if (tickers.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No holdings yet · add positions to see related news
      </div>
    )
  }

  // Aggregate sentiment per ticker
  const tickerSummary = tickers.map(t => {
    const items = newsByTicker[t] || []
    const bullish = items.filter(n => quickScoreSentiment(n.headline, n.summary) === "BULLISH").length
    const bearish = items.filter(n => quickScoreSentiment(n.headline, n.summary) === "BEARISH").length
    const overall = bullish > bearish ? "good" : bearish > bullish ? "bad" : "neutral"
    return { ticker: t, count: items.length, bullish, bearish, overall: overall as "good" | "bad" | "neutral" }
  })

  return (
    <div className="space-y-3">
      <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">
        News by Holding · {tickers.length} tickers
      </div>

      {tickerSummary.map(({ ticker, count, bullish, bearish, overall }) => {
        const items = newsByTicker[ticker] || []
        const isExpanded = expanded[ticker]
        const overallColor = overall === "good" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                          : overall === "bad" ? "text-red-400 bg-red-500/10 border-red-500/30"
                          : "text-gray-400 bg-gray-500/10 border-gray-700"
        const overallLabel = overall === "good" ? "GOOD" : overall === "bad" ? "BAD" : "NEUTRAL"

        return (
          <div key={ticker} className="bg-[#0C1628] border border-[#1A2E52] rounded-xl overflow-hidden">
            {/* Ticker header — click to expand */}
            <button
              onClick={() => setExpanded({ ...expanded, [ticker]: !isExpanded })}
              className="w-full flex items-center justify-between p-3 hover:bg-[#1A2E52]/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-white font-bold text-sm">{ticker}</span>
                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded border", overallColor)}>
                  {overallLabel}
                </span>
                <span className="text-[10px] text-gray-500">
                  {count} news · 🟢 {bullish} · 🔴 {bearish}
                </span>
              </div>
              {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
            </button>

            {/* News items (only when expanded) */}
            {isExpanded && (
              <div className="border-t border-[#1A2E52]/60 p-3 space-y-2">
                {items.length === 0 ? (
                  <div className="text-center py-4 text-gray-600 text-xs">No recent news</div>
                ) : (
                  items.map((article) => {
                    const sentiment = quickScoreSentiment(article.headline, article.summary)
                    const impact = quickScoreImpact(article.headline, article.summary)
                    const ageStr = formatDistanceToNow(new Date(article.datetime * 1000), { addSuffix: true })

                    const SentIcon = sentiment === "BULLISH" ? TrendingUp
                                  : sentiment === "BEARISH" ? TrendingDown : Minus
                    const sentColor = sentiment === "BULLISH" ? "text-emerald-400"
                                    : sentiment === "BEARISH" ? "text-red-400" : "text-gray-500"
                    const sentLabel = sentiment === "BULLISH" ? "GOOD"
                                    : sentiment === "BEARISH" ? "BAD" : "NEUTRAL"
                    const impactColor = impact === "CRITICAL" ? "bg-red-500/20 text-red-300 border-red-500/40"
                                      : impact === "HIGH" ? "bg-orange-500/15 text-orange-300 border-orange-500/30"
                                      : impact === "MEDIUM" ? "bg-yellow-500/10 text-yellow-300 border-yellow-500/20"
                                      : "bg-gray-700/30 text-gray-500 border-gray-700"

                    return (
                      <a
                        key={article.id}
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block bg-[#070B18] border border-[#1A2E52]/60 rounded-lg p-2.5 hover:border-[#00C2D4]/40 transition-colors group"
                      >
                        <div className="flex items-start gap-2">
                          <SentIcon className={cn("w-3.5 h-3.5 flex-shrink-0 mt-0.5", sentColor)} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap mb-1">
                              <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border", sentColor === "text-emerald-400" ? "bg-emerald-500/10 border-emerald-500/30" : sentColor === "text-red-400" ? "bg-red-500/10 border-red-500/30" : "bg-gray-700/30 border-gray-700", sentColor)}>
                                {sentLabel}
                              </span>
                              {impact !== "LOW" && (
                                <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border", impactColor)}>
                                  {impact}
                                </span>
                              )}
                              <span className="text-[9px] text-gray-600">{article.source}</span>
                              <span className="text-[9px] text-gray-700">· {ageStr}</span>
                            </div>
                            <div className="text-xs text-white group-hover:text-cyan-300 transition-colors line-clamp-2 leading-snug">
                              {article.headline}
                            </div>
                          </div>
                        </div>
                      </a>
                    )
                  })
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
