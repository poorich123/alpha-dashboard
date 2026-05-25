"use client"

import { useState, useCallback, useEffect, useMemo, useRef } from "react"
import { RefreshCw, ScanLine, TrendingUp, ChevronLeft, ChevronRight, Filter, Search, X, Timer } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  scanMarket,
  fetchMarketIndices,
  STOCK_UNIVERSE,
  type MarketScanResult,
  type CategoryKey,
  type IndexQuote,
} from "@/lib/marketOverview"
import { SECTOR_GROUPS } from "@/lib/stockLists"
import { HSRHeroBanner } from "@/components/hsr/HSRHeroBanner"
import { PAGE_CHARACTERS } from "@/components/hsr/characters"
import { IndicesBar } from "@/components/market/IndicesBar"
import { StockTable } from "@/components/market/StockTable"
import { CatalystRadar } from "@/components/market/CatalystRadar"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import toast from "react-hot-toast"

// Estimate scan time: ~2 sec per ticker (Yahoo proxy), rounded up
function estimateScanMin(count: number): string {
  const min = Math.max(1, Math.ceil((count * 2) / 60))
  return `~${min} min`
}

const CATEGORY_META: { key: CategoryKey; label: string; emoji: string; baseDesc: string }[] = [
  { key: "sp500",       label: "S&P 500",     emoji: "🇺🇸", baseDesc: "S&P 500 large caps" },
  { key: "etf",         label: "ETF",         emoji: "📊", baseDesc: "Sector + Thematic funds" },
  { key: "nyse",        label: "NYSE",        emoji: "🌍", baseDesc: "Intl ADRs (China/Japan/EM)" },
  { key: "speculative", label: "Speculative", emoji: "🔥", baseDesc: "Momentum small-mid cap" },
]

const CATEGORIES = CATEGORY_META.map(c => {
  const count = STOCK_UNIVERSE[c.key].length
  return {
    ...c,
    description: `${c.baseDesc} · ${count} stocks · ${estimateScanMin(count)}`,
  }
})

const DEFAULT_CATEGORY: CategoryKey = "speculative"

const PAGE_SIZE = 10

// Auto-refresh options (minutes; 0 = off)
const AUTO_REFRESH_OPTIONS = [0, 5, 10, 15] as const
const AUTO_REFRESH_KEY = "market.autoRefreshMin"

type FilterKey = "all" | "buy" | "strong_buy" | "high_conf"
type TechFilterKey = "none" | "near_support" | "broke_resistance" | "rsi_high" | "rsi_low" | "above_ema50" | "below_ema50"

const FILTERS: { key: FilterKey; label: string; emoji: string }[] = [
  { key: "all",        label: "All",         emoji: "🌐" },
  { key: "buy",        label: "Buy+",        emoji: "🟢" },
  { key: "strong_buy", label: "Strong Buy",  emoji: "⭐" },
  { key: "high_conf",  label: "HIGH Conf",   emoji: "🔥" },
]

const TECH_FILTERS: { key: TechFilterKey; label: string }[] = [
  { key: "none",             label: "—" },
  { key: "near_support",     label: "ใกล้แนวรับ" },
  { key: "broke_resistance", label: "ทะลุแนวต้าน" },
  { key: "rsi_high",         label: "RSI > 70" },
  { key: "rsi_low",          label: "RSI < 30" },
  { key: "above_ema50",      label: "เหนือ EMA50" },
  { key: "below_ema50",      label: "ใต้ EMA50" },
]

// Helper: count how many stocks match a tech filter
function countTechMatches(stocks: MarketScanResult[], key: TechFilterKey): number {
  if (key === "none") return stocks.length
  return stocks.filter(s => matchTechFilter(s, key)).length
}

function matchTechFilter(s: MarketScanResult, key: TechFilterKey): boolean {
  switch (key) {
    case "near_support":
      // Within 3% of support level (good buy zone)
      return s.support1 > 0 && (s.currentPrice - s.support1) / s.currentPrice < 0.03
    case "broke_resistance":
      // Near or above 52-week high (ATH territory) OR breaking pivot resistance
      return (s.week52High > 0 && s.currentPrice >= s.week52High * 0.97)
          || (s.resistance1 > 0 && s.currentPrice > s.resistance1)
    case "rsi_high":         return s.rsi > 70
    case "rsi_low":          return s.rsi < 30
    case "above_ema50":      return s.aboveEma50
    case "below_ema50":      return !s.aboveEma50
    case "none":             return true
  }
}

export default function MarketPage() {
  const [category, setCategory] = useState<CategoryKey>(DEFAULT_CATEGORY)
  const [filter, setFilter] = useState<FilterKey>("all")
  const [sectorKey, setSectorKey] = useState<string>("all")        // sector group
  const [techFilter, setTechFilter] = useState<TechFilterKey>("none")
  const [search, setSearch] = useState("")                          // ticker search
  const [page, setPage] = useState(1)
  const [stocks, setStocks] = useState<MarketScanResult[]>([])
  const [indices, setIndices] = useState<IndexQuote[]>([])
  const [scanning, setScanning] = useState(false)
  const [loadingIndices, setLoadingIndices] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [lastScannedAt, setLastScannedAt] = useState<number | null>(null)
  const [autoRefreshMin, setAutoRefreshMin] = useState<number>(0)   // 0 = off
  const [nextRefreshIn, setNextRefreshIn] = useState<number>(0)     // seconds remaining
  const scanningRef = useRef(scanning)
  useEffect(() => { scanningRef.current = scanning }, [scanning])

  const character = PAGE_CHARACTERS.swing  // Firefly — momentum trading

  // ── Fetch indices on mount ─────────────────────────────────────────────
  const loadIndices = useCallback(async () => {
    setLoadingIndices(true)
    try {
      const data = await fetchMarketIndices()
      setIndices(data)
    } catch {
      // ignore
    } finally {
      setLoadingIndices(false)
    }
  }, [])

  useEffect(() => {
    loadIndices()
    // refresh indices every 5 min
    const interval = setInterval(loadIndices, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [loadIndices])

  // ── Scan market ────────────────────────────────────────────────────────
  const handleScan = useCallback(async (cat: CategoryKey, skipCache = false) => {
    setScanning(true)
    setProgress({ done: 0, total: STOCK_UNIVERSE[cat].length })
    setStocks([])
    try {
      const results = await scanMarket(cat, {
        skipCache,
        onProgress: (done, total, latest) => {
          setProgress({ done, total })
          if (latest) {
            setStocks(prev => [...prev, latest].sort((a, b) => b.scorePct - a.scorePct))
          }
        },
      })
      setStocks(results)
      setLastScannedAt(Date.now())
      toast.success(`Scanned ${results.length} stocks`)
    } catch (err) {
      toast.error("Scan failed: " + (err instanceof Error ? err.message : String(err)))
    } finally {
      setScanning(false)
    }
  }, [])

  // Auto-scan on first load
  useEffect(() => {
    handleScan(category)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Auto-refresh: load preference from localStorage on mount ───────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTO_REFRESH_KEY)
      if (saved) {
        const n = parseInt(saved, 10)
        if (AUTO_REFRESH_OPTIONS.includes(n as (typeof AUTO_REFRESH_OPTIONS)[number])) {
          setAutoRefreshMin(n)
        }
      }
    } catch { /* SSR / blocked storage */ }
  }, [])

  // Persist preference
  useEffect(() => {
    try { localStorage.setItem(AUTO_REFRESH_KEY, String(autoRefreshMin)) } catch { /* ignore */ }
  }, [autoRefreshMin])

  // Auto-refresh timer — periodic scan + countdown
  useEffect(() => {
    if (autoRefreshMin === 0) {
      setNextRefreshIn(0)
      return
    }
    const intervalSec = autoRefreshMin * 60
    setNextRefreshIn(intervalSec)

    // Tick every second to update countdown
    const tick = setInterval(() => {
      setNextRefreshIn((prev) => {
        if (prev <= 1) {
          // Time's up — trigger scan if not already scanning
          if (!scanningRef.current) {
            handleScan(category, true)
          }
          return intervalSec  // reset countdown
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(tick)
  }, [autoRefreshMin, category, handleScan])

  // When user switches category
  const handleCategoryChange = (cat: CategoryKey) => {
    setCategory(cat)
    setPage(1)
    handleScan(cat)
  }

  // Reset to page 1 when any filter changes
  useEffect(() => { setPage(1) }, [filter, sectorKey, techFilter, search])

  const progressPct = progress.total > 0 ? (progress.done / progress.total) * 100 : 0

  // Apply all filters (sector → search → signal → tech)
  const filtered = useMemo(() => {
    let arr = stocks

    // 1. Sector filter
    if (sectorKey !== "all" && SECTOR_GROUPS[sectorKey]) {
      const allowed = new Set(SECTOR_GROUPS[sectorKey].tickers)
      arr = arr.filter(s => allowed.has(s.ticker))
    }

    // 2. Search filter (ticker or company name, case-insensitive)
    const q = search.trim().toUpperCase()
    if (q) {
      arr = arr.filter(s =>
        s.ticker.includes(q) ||
        (s.companyName && s.companyName.toUpperCase().includes(q))
      )
    }

    // 3. Signal filter
    if (filter === "buy")        arr = arr.filter(s => s.signal === "BUY" || s.signal === "STRONG BUY")
    else if (filter === "strong_buy") arr = arr.filter(s => s.signal === "STRONG BUY")
    else if (filter === "high_conf")  arr = arr.filter(s => s.confidence === "HIGH")

    // 4. Technical filter
    if (techFilter !== "none") {
      arr = arr.filter(s => matchTechFilter(s, techFilter))
    }

    return arr
  }, [stocks, filter, sectorKey, techFilter, search])

  // Tech filter counts (computed from stocks after sector + signal filter, before tech filter)
  const techCounts = useMemo(() => {
    let baseArr = stocks
    if (sectorKey !== "all" && SECTOR_GROUPS[sectorKey]) {
      const allowed = new Set(SECTOR_GROUPS[sectorKey].tickers)
      baseArr = baseArr.filter(s => allowed.has(s.ticker))
    }
    if (filter === "buy")        baseArr = baseArr.filter(s => s.signal === "BUY" || s.signal === "STRONG BUY")
    else if (filter === "strong_buy") baseArr = baseArr.filter(s => s.signal === "STRONG BUY")
    else if (filter === "high_conf")  baseArr = baseArr.filter(s => s.confidence === "HIGH")

    return Object.fromEntries(
      TECH_FILTERS.map(t => [t.key, countTechMatches(baseArr, t.key)])
    ) as Record<TechFilterKey, number>
  }, [stocks, filter, sectorKey])

  // Paginate
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageStart = (page - 1) * PAGE_SIZE
  const pageStocks = filtered.slice(pageStart, pageStart + PAGE_SIZE)

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      {/* ── HSR Banner ─────────────────────────────────────────────── */}
      <HSRHeroBanner character={character} title="Market Overview" height="h-44">
        <div className="text-[10px] tracking-[0.2em] uppercase font-semibold mb-1" style={{ color: character.color }}>
          Market Screener
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">Market Overview</h1>
        <div className="text-xs text-gray-400 mb-3">
          Auto-scan + rank stocks · find best swing setups across categories
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={() => handleScan(category, true)}
            disabled={scanning}
            className="bg-[#00C2D4] hover:bg-[#00A8BC] gap-1 h-8 text-xs"
          >
            {scanning ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ScanLine className="w-3 h-3" />}
            {scanning ? `Scanning ${progress.done}/${progress.total}…` : "Scan Market"}
          </Button>

          {/* Auto-refresh toggle */}
          <div className="flex items-center gap-1 bg-[#0A1424]/60 border border-[#1A2E52] rounded-lg px-1.5 py-0.5">
            <Timer className="w-3 h-3 text-gray-500" />
            <span className="text-[10px] text-gray-500 mr-1">Auto</span>
            {AUTO_REFRESH_OPTIONS.map((n) => {
              const active = autoRefreshMin === n
              return (
                <button
                  key={n}
                  onClick={() => setAutoRefreshMin(n)}
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors",
                    active
                      ? "bg-[#00C2D4]/20 text-[#00D8EE] border border-[#00C2D4]/40"
                      : "text-gray-500 hover:text-gray-300 border border-transparent",
                  )}
                >
                  {n === 0 ? "OFF" : `${n}m`}
                </button>
              )
            })}
            {autoRefreshMin > 0 && nextRefreshIn > 0 && (
              <span className="text-[10px] text-cyan-400/70 ml-1 tabular-nums">
                · {Math.floor(nextRefreshIn / 60)}:{String(nextRefreshIn % 60).padStart(2, "0")}
              </span>
            )}
          </div>

          {lastScannedAt && (
            <span className="text-[10px] text-gray-600">
              Last scan {formatDistanceToNow(lastScannedAt, { addSuffix: true })}
            </span>
          )}
        </div>
      </HSRHeroBanner>

      {/* ── Market Indices Bar ────────────────────────────────────── */}
      <div className="mb-2">
        <div className="text-xs text-gray-500 uppercase tracking-widest mb-2">Market Indices</div>
        <IndicesBar indices={indices} loading={loadingIndices} />
      </div>

      {/* ── Catalyst Radar — news + volume + gap (skip ETF — funds don't have catalysts) ── */}
      {category !== "etf" && <CatalystRadar />}

      {/* ── Category Tabs ─────────────────────────────────────────── */}
      <div className="bg-[#0C1628] border border-[#1A2E52] rounded-2xl p-2 mb-3 flex gap-1 hsr-card">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => handleCategoryChange(cat.key)}
            disabled={scanning}
            className={cn(
              "flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors flex flex-col items-center gap-0.5",
              category === cat.key
                ? "bg-[#00C2D4]/15 text-[#00D8EE] border border-[#00C2D4]/40"
                : "text-gray-400 hover:bg-[#1A2E52]/40 border border-transparent",
            )}
          >
            <div className="flex items-center gap-1.5">
              <span>{cat.emoji}</span>
              <span className="font-bold">{cat.label}</span>
            </div>
            <span className="text-[9px] text-gray-600">{cat.description}</span>
          </button>
        ))}
      </div>

      {/* ── Progress bar during scan ──────────────────────────────── */}
      {scanning && (
        <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-3 mb-3">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
            <span>Scanning {category}…</span>
            <span>{progress.done} / {progress.total}</span>
          </div>
          <div className="h-1.5 bg-[#1A2E52] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#00C2D4] to-[#00D8EE] transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Sector Tabs (Rocket Tool style) + Search ─────────────── */}
      <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-2 mb-2 hsr-card">
        {/* Search box */}
        <div className="relative mb-2">
          <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหา ticker หรือชื่อบริษัท (เช่น NVDA, Tesla, Quantum)…"
            className="w-full bg-[#0A1424] border border-[#1A2E52] rounded-lg pl-8 pr-8 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:border-[#00C2D4]/50 focus:outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {/* Sector tabs */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSectorKey("all")}
            className={cn(
              "px-3 py-1 rounded-lg text-xs font-medium transition-colors",
              sectorKey === "all"
                ? "bg-[#00C2D4]/15 text-[#00D8EE] border border-[#00C2D4]/40"
                : "text-gray-400 hover:bg-[#1A2E52]/40 border border-transparent",
            )}
          >
            🌐 ทั้งหมด <span className="text-[10px] text-gray-600">({stocks.length})</span>
          </button>
          {Object.entries(SECTOR_GROUPS).map(([key, group]) => {
            const allowed = new Set(group.tickers)
            const count = stocks.filter(s => allowed.has(s.ticker)).length
            const isActive = sectorKey === key
            return (
              <button
                key={key}
                onClick={() => setSectorKey(key)}
                disabled={count === 0 && !isActive}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-medium transition-colors",
                  isActive
                    ? "bg-[#00C2D4]/15 text-[#00D8EE] border border-[#00C2D4]/40"
                    : count > 0
                    ? "text-gray-400 hover:bg-[#1A2E52]/40 border border-transparent"
                    : "text-gray-700 border border-transparent cursor-not-allowed",
                )}
              >
                {group.emoji} {group.label}{" "}
                <span className={cn(
                  "text-[10px]",
                  isActive ? "text-[#00D8EE]/70" : "text-gray-600"
                )}>({count})</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Filter Bar — Signal (Rocket Tool style) ──────────────── */}
      <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-2 mb-2 flex items-center gap-2 hsr-card flex-wrap">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider px-2 flex items-center gap-1">
          <Filter className="w-3 h-3" /> Signal
        </span>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "px-3 py-1 rounded-lg text-xs font-medium transition-colors",
              filter === f.key
                ? "bg-[#00C2D4]/15 text-[#00D8EE] border border-[#00C2D4]/40"
                : "text-gray-500 hover:bg-[#1A2E52]/40 border border-transparent",
            )}
          >
            {f.emoji} {f.label}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-gray-600 pr-2">
          {filtered.length} matching · {stocks.length} scanned
        </span>
      </div>

      {/* ── Technical Filter — with counts (Rocket Tool style) ────── */}
      <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-2 mb-3 flex items-center gap-2 hsr-card flex-wrap">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider px-2">
          ตัวกรอง
        </span>
        {TECH_FILTERS.filter(t => t.key !== "none").map((t) => {
          const count = techCounts[t.key] || 0
          const isActive = techFilter === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTechFilter(isActive ? "none" : t.key)}
              disabled={count === 0 && !isActive}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-medium transition-colors",
                isActive
                  ? "bg-purple-500/15 text-purple-300 border border-purple-500/40"
                  : count > 0
                  ? "text-gray-400 hover:bg-[#1A2E52]/40 border border-transparent"
                  : "text-gray-700 border border-transparent cursor-not-allowed",
              )}
            >
              {t.label} <span className={cn(
                "ml-1 text-[10px]",
                isActive ? "text-purple-400" : "text-gray-600"
              )}>({count})</span>
            </button>
          )
        })}
        {techFilter !== "none" && (
          <button
            onClick={() => setTechFilter("none")}
            className="text-[10px] text-cyan-400 hover:text-cyan-200 ml-auto"
          >
            Clear tech filter ×
          </button>
        )}
      </div>

      {/* ── Section title ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <h2 className="text-base font-bold text-white">
            {CATEGORIES.find(c => c.key === category)?.label}
          </h2>
          <span className="text-xs text-gray-500">
            sorted: <span className="text-emerald-400">STRONG BUY</span> →{" "}
            <span className="text-green-400">BUY</span> →{" "}
            <span className="text-yellow-400">HOLD</span> →{" "}
            <span className="text-orange-400">SELL</span> →{" "}
            <span className="text-red-400">STRONG SELL</span>
          </span>
        </div>
        <span className="text-[10px] text-gray-600">
          Page {page} of {totalPages} · Showing {pageStocks.length} of {filtered.length}
        </span>
      </div>

      {/* ── Stock Table ──────────────────────────────────────────── */}
      <StockTable stocks={pageStocks} loading={scanning} />

      {/* ── Pagination ───────────────────────────────────────────── */}
      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-3 bg-[#0C1628] border border-[#1A2E52] rounded-xl p-2 hsr-card">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="border-[#1F3566] text-gray-300 gap-1 h-8 text-xs"
          >
            <ChevronLeft className="w-3 h-3" /> Previous
          </Button>

          {/* Page numbers */}
          <div className="flex gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .map((p, idx, arr) => (
                <div key={p} className="flex gap-1 items-center">
                  {idx > 0 && arr[idx - 1] < p - 1 && (
                    <span className="text-gray-700 px-1">…</span>
                  )}
                  <button
                    onClick={() => setPage(p)}
                    className={cn(
                      "min-w-[28px] h-7 text-xs rounded font-medium transition-colors",
                      p === page
                        ? "bg-[#00C2D4]/15 text-[#00D8EE] border border-[#00C2D4]/40"
                        : "text-gray-400 hover:bg-[#1A2E52]/40 border border-transparent"
                    )}
                  >
                    {p}
                  </button>
                </div>
              ))}
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="border-[#1F3566] text-gray-300 gap-1 h-8 text-xs"
          >
            Next <ChevronRight className="w-3 h-3" />
          </Button>
        </div>
      )}

      {/* ── Legend ───────────────────────────────────────────────── */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-[10px] text-gray-500">
        <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-3">
          <div className="text-gray-400 font-semibold mb-1">Signal Levels</div>
          <div className="flex flex-wrap gap-2">
            <span className="text-emerald-400">STRONG BUY</span>
            <span className="text-green-400">BUY</span>
            <span className="text-yellow-400">HOLD</span>
            <span className="text-orange-400">SELL</span>
            <span className="text-red-400">STRONG SELL</span>
          </div>
        </div>
        <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-3">
          <div className="text-gray-400 font-semibold mb-1">Momentum Bars (1D · 1W · 1M · 3M · 6M · 1Y)</div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
            <span>Strong Buy</span>
            <div className="w-2.5 h-2.5 rounded-sm bg-yellow-500 ml-2" />
            <span>Neutral</span>
            <div className="w-2.5 h-2.5 rounded-sm bg-red-500 ml-2" />
            <span>Strong Sell</span>
          </div>
        </div>
      </div>

      <div className="mt-4 text-[10px] text-gray-600 text-center">
        💡 Click any ticker → opens full Analyzer · Cache stays fresh for 30 minutes
      </div>
    </div>
  )
}
