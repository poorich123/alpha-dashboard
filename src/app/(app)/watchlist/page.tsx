"use client"

import { useState } from "react"
import { Plus, Edit2, Trash2, TrendingUp, Clock, Flame } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { usePortfolioStore } from "@/store/portfolioStore"
import { useAlertStore } from "@/store/alertStore"
import { getCompanyProfile, getMultipleQuotes } from "@/lib/finnhub"
import { runWatchlistScan } from "@/lib/swingScanner"
import type { WatchlistItem } from "@/types"
import type { TechnicalScanResult } from "@/lib/swingScanner"
import toast from "react-hot-toast"
import { InlineSpinner } from "@/components/ui/LoadingSpinner"
import { differenceInDays, parseISO, formatDistanceToNow } from "date-fns"
import { getWatchlist, saveWatchlist } from "@/lib/portfolio"
import { ScanLine } from "lucide-react"

function getZoneStatus(item: WatchlistItem): { label: string; color: string; icon: React.ReactNode } {
  if (!item.currentPrice) return { label: "No Price", color: "text-gray-400", icon: <Clock className="w-3 h-3" /> }
  const price = item.currentPrice
  const midZone = (item.entryZoneLow + item.entryZoneHigh) / 2
  if (price >= item.entryZoneLow && price <= item.entryZoneHigh) {
    return { label: "🔥 IN ZONE", color: "text-orange-400", icon: <Flame className="w-3 h-3" /> }
  }
  if (price <= item.entryZoneHigh * 1.1) {
    return { label: "👀 WATCHING", color: "text-yellow-400", icon: <TrendingUp className="w-3 h-3" /> }
  }
  return { label: "⏳ PATIENT", color: "text-gray-400", icon: <Clock className="w-3 h-3" /> }
}

const PRIORITY_COLORS = {
  high: "bg-red-500/20 text-red-400",
  medium: "bg-yellow-500/20 text-yellow-400",
  low: "bg-gray-500/20 text-gray-400",
}

// Score display helpers
const SCORE_CONFIG = {
  5: { label: "STRONG BUY", color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/40", stars: "⭐⭐⭐⭐⭐" },
  4: { label: "BUY",        color: "text-green-400",   bg: "bg-green-500/15 border-green-500/30",     stars: "⭐⭐⭐⭐" },
  3: { label: "WAIT",       color: "text-yellow-400",  bg: "bg-yellow-500/15 border-yellow-500/30",   stars: "⭐⭐⭐" },
  2: { label: "CAUTION",    color: "text-orange-400",  bg: "bg-orange-500/15 border-orange-500/30",   stars: "⭐⭐" },
  1: { label: "AVOID",      color: "text-red-400",     bg: "bg-red-500/15 border-red-500/40",         stars: "⭐" },
}

function TechScoreBadge({ scan }: { scan: TechnicalScanResult }) {
  const cfg = SCORE_CONFIG[scan.score]
  return (
    <div className={`rounded-lg border px-2 py-1.5 ${cfg.bg}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-xs font-bold" style={{ fontSize: "10px" }}>{scan.score}/5</span>
        <span className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
      </div>
      {/* Mini signals row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`text-[9px] px-1 rounded ${scan.rsi >= 50 && scan.rsi <= 65 ? "text-emerald-400 bg-emerald-500/10" : scan.rsi < 40 ? "text-red-400 bg-red-500/10" : "text-yellow-400 bg-yellow-500/10"}`}>
          RSI {scan.rsi.toFixed(0)}
        </span>
        <span className={`text-[9px] px-1 rounded ${scan.aboveEma50 ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"}`}>
          {scan.aboveEma50 ? "▲EMA50" : "▼EMA50"}
        </span>
        <span className={`text-[9px] px-1 rounded ${scan.macdHistogram > 0 ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"}`}>
          MACD {scan.macdHistogram > 0 ? "↑" : "↓"}
        </span>
        <span className={`text-[9px] px-1 rounded ${scan.volumeRatio >= 1.2 ? "text-cyan-400 bg-cyan-500/10" : "text-gray-500 bg-gray-800"}`}>
          Vol {(scan.volumeRatio * 100).toFixed(0)}%
        </span>
      </div>
      <div className="text-[9px] text-gray-600 mt-0.5">
        {scan.trend} · {formatDistanceToNow(scan.scannedAt, { addSuffix: true })}
      </div>
    </div>
  )
}

export default function WatchlistPage() {
  const { watchlist, setWatchlist } = usePortfolioStore()
  const { watchlistScans, setWatchlistScans } = useAlertStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<WatchlistItem | null>(null)
  const [fetching, setFetching] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [form, setForm] = useState<Partial<WatchlistItem>>({
    ticker: "",
    companyName: "",
    entryZoneLow: 0,
    entryZoneHigh: 0,
    targetPrice: 0,
    stopLoss: 0,
    thesis: "",
    priority: "medium",
    notes: "",
    sector: "",
  })

  async function fetchInfo() {
    if (!form.ticker) return
    setFetching(true)
    try {
      const profile = await getCompanyProfile(form.ticker.toUpperCase())
      if (profile.name) {
        setForm((f) => ({ ...f, companyName: profile.name, sector: profile.finnhubIndustry || "", logoUrl: profile.logo }))
        toast.success("Found: " + profile.name)
      }
    } catch {
      toast.error("Company not found")
    } finally {
      setFetching(false)
    }
  }

  function openAdd() {
    setEditItem(null)
    setForm({
      ticker: "",
      companyName: "",
      entryZoneLow: 0,
      entryZoneHigh: 0,
      targetPrice: 0,
      stopLoss: 0,
      thesis: "",
      priority: "medium",
      notes: "",
      sector: "",
    })
    setModalOpen(true)
  }

  function openEdit(item: WatchlistItem) {
    setEditItem(item)
    setForm({ ...item })
    setModalOpen(true)
  }

  function handleSave() {
    if (!form.ticker || !form.companyName) {
      toast.error("Ticker and company name required")
      return
    }
    if (editItem) {
      const updated = watchlist.map((w) => w.id === editItem.id ? { ...w, ...form } as WatchlistItem : w)
      setWatchlist(updated)
      toast.success("Watchlist item updated")
    } else {
      const item: WatchlistItem = {
        id: crypto.randomUUID(),
        ticker: form.ticker!.toUpperCase(),
        companyName: form.companyName!,
        logoUrl: (form as Record<string, unknown>).logoUrl as string || "",
        entryZoneLow: Number(form.entryZoneLow) || 0,
        entryZoneHigh: Number(form.entryZoneHigh) || 0,
        targetPrice: Number(form.targetPrice) || 0,
        stopLoss: Number(form.stopLoss) || 0,
        thesis: form.thesis || "",
        priority: form.priority as WatchlistItem["priority"] || "medium",
        notes: form.notes || "",
        addedDate: new Date().toISOString().split("T")[0],
        sector: form.sector || "",
      }
      setWatchlist([...watchlist, item])
      toast.success("Added to watchlist")
    }
    setModalOpen(false)
  }

  function handleDelete(id: string) {
    setWatchlist(watchlist.filter((w) => w.id !== id))
    toast.success("Removed from watchlist")
  }

  async function refreshPrices() {
    setRefreshing(true)
    try {
      const tickers = watchlist.map((w) => w.ticker)
      if (!tickers.length) return
      const quotes = await getMultipleQuotes(tickers)
      const updated = watchlist.map((w) => ({
        ...w,
        currentPrice: quotes[w.ticker]?.c || w.currentPrice,
      }))
      setWatchlist(updated)
      toast.success("Prices refreshed")
    } catch {
      toast.error("Failed to refresh prices")
    } finally {
      setRefreshing(false)
    }
  }

  async function runScan() {
    if (!watchlist.length) return
    setScanning(true)
    try {
      // Refresh prices first, then scan
      const tickers = watchlist.map((w) => w.ticker)
      const quotes = await getMultipleQuotes(tickers)
      const withPrices = watchlist.map((w) => ({
        ...w,
        currentPrice: quotes[w.ticker]?.c || w.currentPrice || 0,
      }))
      setWatchlist(withPrices)

      const results = await runWatchlistScan(withPrices)
      setWatchlistScans(results)
      toast.success(`Scanned ${Object.keys(results).length} stock${Object.keys(results).length !== 1 ? "s" : ""}`)
    } catch {
      toast.error("Scan failed — check Finnhub API key")
    } finally {
      setScanning(false)
    }
  }

  const sorted = [...watchlist].sort((a, b) => {
    const prio = { high: 0, medium: 1, low: 2 }
    return prio[a.priority] - prio[b.priority]
  })

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Watchlist</h1>
          <div className="text-sm text-gray-400">{watchlist.length} stocks on watch</div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={runScan}
            disabled={scanning || !watchlist.length}
            className="border-[#1F3566] text-cyan-400 hover:bg-[#1A2E52] gap-1"
            title="Run technical analysis scan on all watchlist items"
          >
            {scanning ? <InlineSpinner className="w-3 h-3" /> : <ScanLine className="w-3 h-3" />}
            {scanning ? "Scanning…" : "Scan"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshPrices}
            disabled={refreshing}
            className="border-[#1F3566] text-gray-300"
          >
            {refreshing ? <InlineSpinner className="mr-1" /> : null}
            Refresh
          </Button>
          <Button size="sm" onClick={openAdd} className="bg-[#00C2D4] hover:bg-[#00A8BC]">
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-4">👀</div>
          <div className="text-white font-medium mb-2">No stocks on watchlist</div>
          <div className="text-gray-500 text-sm mb-4">Add stocks you're monitoring for entry</div>
          <Button onClick={openAdd} className="bg-[#00C2D4] hover:bg-[#00A8BC]">
            <Plus className="w-4 h-4 mr-1" /> Add to Watchlist
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sorted.map((item) => {
            const status = getZoneStatus(item)
            const daysWatching = differenceInDays(new Date(), parseISO(item.addedDate))
            const targetUpside = item.currentPrice && item.targetPrice
              ? ((item.targetPrice - item.currentPrice) / item.currentPrice * 100)
              : null
            const scan = watchlistScans[item.ticker.toUpperCase()]
            const scoreCfg = scan ? SCORE_CONFIG[scan.score] : null

            return (
              <div
                key={item.id}
                className="bg-[#0C1628] rounded-xl p-4 card-hover border"
                style={{
                  borderColor: scan && scoreCfg
                    ? scan.score >= 4 ? "rgba(34,197,94,0.3)"
                    : scan.score === 3 ? "rgba(234,179,8,0.2)"
                    : "rgba(239,68,68,0.2)"
                    : "#1A2E52"
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {item.logoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.logoUrl} alt="" className="w-8 h-8 rounded" onError={(e) => (e.currentTarget.style.display = "none")} />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold">{item.ticker}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${PRIORITY_COLORS[item.priority]}`}>
                          {item.priority}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">{item.companyName}</div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(item)} className="w-7 h-7 p-0 text-gray-400">
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(item.id)} className="w-7 h-7 p-0 text-gray-400 hover:text-red-400">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {/* Technical Score Badge */}
                {scan && (
                  <div className="mb-3">
                    <TechScoreBadge scan={scan} />
                  </div>
                )}

                {/* Current Price & Status */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    {item.currentPrice ? (
                      <div className="text-lg font-bold text-white">${item.currentPrice.toFixed(2)}</div>
                    ) : (
                      <div className="text-gray-500 text-sm">No price data</div>
                    )}
                    <div className="text-xs text-gray-500">
                      Entry zone: ${item.entryZoneLow} – ${item.entryZoneHigh}
                    </div>
                  </div>
                  <div className={`text-xs font-medium ${status.color}`}>{status.label}</div>
                </div>

                {/* Entry zone progress */}
                {item.currentPrice && item.entryZoneLow > 0 && (
                  <div className="mb-3">
                    <div className="h-1.5 bg-[#1A2E52] rounded-full overflow-hidden relative">
                      <div className="absolute h-full bg-yellow-500/30 rounded-full"
                        style={{
                          left: `${Math.max(0, ((item.entryZoneLow - item.entryZoneLow * 0.9) / (item.entryZoneHigh * 1.1 - item.entryZoneLow * 0.9)) * 100)}%`,
                          width: `${((item.entryZoneHigh - item.entryZoneLow) / (item.entryZoneHigh * 1.1 - item.entryZoneLow * 0.9)) * 100}%`,
                        }}
                      />
                      <div className="absolute w-1 h-full bg-white"
                        style={{
                          left: `${Math.max(0, Math.min(98, ((item.currentPrice - item.entryZoneLow * 0.9) / (item.entryZoneHigh * 1.1 - item.entryZoneLow * 0.9)) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Target / Upside */}
                {targetUpside !== null && (
                  <div className="flex items-center gap-2 mb-3 text-xs">
                    <TrendingUp className="w-3 h-3 text-green-400" />
                    <span className="text-gray-400">Target ${item.targetPrice}</span>
                    <span className="text-green-400">+{targetUpside.toFixed(0)}%</span>
                  </div>
                )}

                {/* Thesis */}
                {item.thesis && (
                  <div className="text-xs text-gray-500 border-t border-[#1A2E52] pt-2">
                    {item.thesis.slice(0, 120)}{item.thesis.length > 120 ? "..." : ""}
                  </div>
                )}

                {/* Scan summary */}
                {scan && (
                  <div className="text-[10px] text-gray-600 border-t border-[#1A2E52]/50 pt-1.5 mt-1.5 italic leading-relaxed">
                    {scan.summary}
                  </div>
                )}

                <div className="flex items-center justify-between mt-2 text-xs text-gray-600">
                  <span>{item.sector}</span>
                  <span>Watching {daysWatching}d</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-[#0C1628] border-[#1A2E52] text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit Watchlist Item" : "Add to Watchlist"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Ticker</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={form.ticker || ""}
                  onChange={(e) => setForm({ ...form, ticker: e.target.value.toUpperCase() })}
                  className="bg-[#1A2E52] border-[#1F3566] text-white font-mono uppercase"
                />
                <Button variant="outline" onClick={fetchInfo} disabled={fetching} className="border-[#1F3566]">
                  {fetching ? <InlineSpinner /> : "Fetch"}
                </Button>
              </div>
            </div>
            <div className="col-span-2">
              <Label>Company Name</Label>
              <Input
                value={form.companyName || ""}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                className="bg-[#1A2E52] border-[#1F3566] text-white mt-1"
              />
            </div>
            <div>
              <Label>Entry Zone Low ($)</Label>
              <Input type="number" value={form.entryZoneLow || ""} onChange={(e) => setForm({ ...form, entryZoneLow: parseFloat(e.target.value) })} className="bg-[#1A2E52] border-[#1F3566] text-white mt-1" />
            </div>
            <div>
              <Label>Entry Zone High ($)</Label>
              <Input type="number" value={form.entryZoneHigh || ""} onChange={(e) => setForm({ ...form, entryZoneHigh: parseFloat(e.target.value) })} className="bg-[#1A2E52] border-[#1F3566] text-white mt-1" />
            </div>
            <div>
              <Label>Target Price ($)</Label>
              <Input type="number" value={form.targetPrice || ""} onChange={(e) => setForm({ ...form, targetPrice: parseFloat(e.target.value) })} className="bg-[#1A2E52] border-[#1F3566] text-white mt-1" />
            </div>
            <div>
              <Label>Stop Loss ($)</Label>
              <Input type="number" value={form.stopLoss || ""} onChange={(e) => setForm({ ...form, stopLoss: parseFloat(e.target.value) })} className="bg-[#1A2E52] border-[#1F3566] text-white mt-1" />
            </div>
            <div className="col-span-2">
              <Label>Priority</Label>
              <Select value={form.priority || "medium"} onValueChange={(v) => setForm({ ...form, priority: v as "high" | "medium" | "low" })}>
                <SelectTrigger className="bg-[#1A2E52] border-[#1F3566] text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1A2E52] border-[#1F3566]">
                  <SelectItem value="high" className="text-white">🔴 High</SelectItem>
                  <SelectItem value="medium" className="text-white">🟡 Medium</SelectItem>
                  <SelectItem value="low" className="text-white">🟢 Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Thesis</Label>
              <Textarea value={form.thesis || ""} onChange={(e) => setForm({ ...form, thesis: e.target.value })} rows={3} className="bg-[#1A2E52] border-[#1F3566] text-white mt-1 resize-none" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" onClick={() => setModalOpen(false)} className="flex-1 border-[#1F3566]">Cancel</Button>
            <Button onClick={handleSave} className="flex-1 bg-[#00C2D4] hover:bg-[#00A8BC]">Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
