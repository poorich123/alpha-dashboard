"use client"

import { useState, useEffect, useCallback } from "react"
import { RefreshCw, ExternalLink, Calendar, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { usePortfolioStore } from "@/store/portfolioStore"
import { getMarketNews, getNews, getEarningsCalendar, getEconomicCalendar } from "@/lib/finnhub"
import type { NewsItem, EarningsCalendarItem, EconomicEvent } from "@/types"
import { format, addDays, formatDistanceToNow, parseISO } from "date-fns"
import { InlineSpinner } from "@/components/ui/LoadingSpinner"
import toast from "react-hot-toast"

type Filter = "all" | "holdings" | "macro" | "earnings"

export default function NewsPage() {
  const { positions } = usePortfolioStore()
  const [filter, setFilter] = useState<Filter>("all")
  const [news, setNews] = useState<NewsItem[]>([])
  const [earnings, setEarnings] = useState<EarningsCalendarItem[]>([])
  const [economic, setEconomic] = useState<EconomicEvent[]>([])
  const [loading, setLoading] = useState(false)

  const tickers = positions.filter((p) => p.isActive && p.category !== "watchlist").map((p) => p.ticker)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const from = format(new Date(), "yyyy-MM-dd")
      const to = format(addDays(new Date(), 30), "yyyy-MM-dd")

      const [marketNews, earningsData, econData] = await Promise.all([
        getMarketNews(),
        getEarningsCalendar(from, to),
        getEconomicCalendar(),
      ])

      setNews(marketNews.slice(0, 50))
      setEarnings(earningsData.slice(0, 30))
      setEconomic(econData.slice(0, 20))

      // Also fetch news for holdings
      if (tickers.length > 0) {
        try {
          const holdingNews = await getNews(tickers[0])
          setNews((prev) => {
            const ids = new Set(prev.map((n) => n.id))
            return [...prev, ...holdingNews.filter((n) => !ids.has(n.id))].slice(0, 100)
          })
        } catch {
          // ignore
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

  const myTickerSet = new Set(tickers)

  const filteredNews = news.filter((n) => {
    if (filter === "holdings") {
      return tickers.some((t) => n.related?.includes(t) || n.headline.includes(t))
    }
    if (filter === "macro") {
      return ["general", "forex", "crypto"].includes(n.category || "")
    }
    return true
  })

  const myEarnings = earnings.filter((e) => myTickerSet.has(e.symbol))
  const allEarnings = earnings.filter((e) => !myTickerSet.has(e.symbol)).slice(0, 10)

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
