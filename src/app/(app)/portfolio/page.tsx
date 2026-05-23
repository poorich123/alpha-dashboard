"use client"

import { useState } from "react"
import { Plus, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { usePortfolioStore } from "@/store/portfolioStore"
import { PositionCard } from "@/components/portfolio/PositionCard"
import { AddPositionModal } from "@/components/portfolio/AddPositionModal"
import type { Position } from "@/types"
import { getMultipleQuotes } from "@/lib/finnhub"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"
import toast from "react-hot-toast"

const TABS = [
  { value: "all", label: "All" },
  { value: "core", label: "💎 Core" },
  { value: "defensive", label: "🛡️ Defensive" },
  { value: "satellite", label: "🛸 Satellite" },
  { value: "speculative", label: "🎯 Speculative" },
  { value: "etf", label: "💰 ETFs" },
  { value: "watchlist", label: "👀 Watchlist" },
]

const CATEGORY_COLORS: Record<string, string> = {
  core: "#00C2D4",
  defensive: "#22c55e",
  satellite: "#3b82f6",
  speculative: "#f59e0b",
  etf: "#06b6d4",
  watchlist: "#9ca3af",
  cash: "#6b7280",
}

export default function PortfolioPage() {
  const { positions, stats, updatePosition } = usePortfolioStore()
  const [activeTab, setActiveTab] = useState("all")
  const [modalOpen, setModalOpen] = useState(false)
  const [editPosition, setEditPosition] = useState<Position | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const activePositions = positions.filter((p) => p.isActive)

  const filtered =
    activeTab === "all"
      ? activePositions
      : activePositions.filter((p) => p.category === activeTab)

  const tabCounts = TABS.slice(1).reduce((acc, t) => {
    acc[t.value] = activePositions.filter((p) => p.category === t.value).length
    return acc
  }, {} as Record<string, number>)

  async function refreshPrices() {
    setRefreshing(true)
    try {
      const tickers = activePositions.map((p) => p.ticker)
      if (tickers.length === 0) return
      const quotes = await getMultipleQuotes(tickers)
      tickers.forEach((ticker) => {
        const q = quotes[ticker]
        if (q) {
          const pos = activePositions.find((p) => p.ticker === ticker)
          if (pos) updatePosition(pos.id, { currentPrice: q.c })
        }
      })
      toast.success("Prices refreshed")
    } catch {
      toast.error("Failed to refresh prices")
    } finally {
      setRefreshing(false)
    }
  }

  function handleEdit(position: Position) {
    setEditPosition(position)
    setModalOpen(true)
  }

  function handleCloseModal() {
    setModalOpen(false)
    setEditPosition(null)
  }

  // Allocation chart data
  const allocationData = stats
    ? Object.entries(stats.allocation)
        .filter(([, v]) => v > 0)
        .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(1)) }))
    : []

  const sectorData = stats
    ? Object.entries(stats.sectorAllocation)
        .filter(([, v]) => v > 0)
        .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(1)) }))
    : []

  const totalValue = activePositions.reduce((sum, p) => sum + p.shares * p.currentPrice, 0)
  const totalPnL = activePositions.reduce((sum, p) => sum + p.shares * (p.currentPrice - p.avgCost), 0)

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Portfolio</h1>
          <div className="text-sm text-gray-400">
            {activePositions.length} positions •{" "}
            <span className={totalPnL >= 0 ? "text-green-400" : "text-red-400"}>
              {totalPnL >= 0 ? "+" : ""}${totalPnL.toFixed(0)} total P&L
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshPrices}
            disabled={refreshing}
            className="border-[#1F3566] text-gray-300 hover:bg-[#1A2E52]"
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
            Prices
          </Button>
          <Button
            size="sm"
            onClick={() => setModalOpen(true)}
            className="bg-[#00C2D4] hover:bg-[#00A8BC]"
          >
            <Plus className="w-4 h-4 mr-1" /> Add Position
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
            <TabsList className="bg-[#0C1628] border border-[#1A2E52] flex-wrap h-auto">
              {TABS.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="data-[state=active]:bg-[#00C2D4] data-[state=active]:text-[#070B18] text-gray-400 text-xs"
                >
                  {tab.label}
                  {tab.value !== "all" && tabCounts[tab.value] > 0 && (
                    <span className="ml-1 text-xs opacity-60">({tabCounts[tab.value]})</span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Position Cards Grid */}
          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((p) => (
                <PositionCard
                  key={p.id}
                  position={p}
                  onEdit={handleEdit}
                  totalPortfolioValue={totalValue}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="text-4xl mb-4">📭</div>
              <div className="text-white font-medium mb-2">No positions in this category</div>
              <div className="text-gray-500 text-sm mb-4">
                {activeTab === "all"
                  ? "Add your first position to get started"
                  : `No ${activeTab} positions yet`}
              </div>
              <Button onClick={() => setModalOpen(true)} className="bg-[#00C2D4] hover:bg-[#00A8BC]">
                <Plus className="w-4 h-4 mr-1" /> Add Position
              </Button>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-64 space-y-4 flex-shrink-0">
          {/* Allocation Chart */}
          <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-3">Allocation</div>
            {allocationData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={allocationData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      dataKey="value"
                    >
                      {allocationData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={CATEGORY_COLORS[entry.name] || `hsl(${i * 60}, 70%, 50%)`}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "#0C1628", border: "1px solid #1A2E52", borderRadius: "8px" }}
                      labelStyle={{ color: "#f9fafb" }}
                      formatter={(val: number) => [`${val.toFixed(1)}%`]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 mt-2">
                  {allocationData.map((d) => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: CATEGORY_COLORS[d.name] || "#9ca3af" }}
                        />
                        <span className="text-gray-400 capitalize">{d.name}</span>
                      </div>
                      <span className="text-white">{d.value.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-gray-500 text-xs text-center py-4">No positions</div>
            )}
          </div>

          {/* Sector Chart */}
          <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-3">By Sector</div>
            {sectorData.length > 0 ? (
              <div className="space-y-2">
                {sectorData.map((d, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-gray-400 truncate">{d.name}</span>
                      <span className="text-white">{d.value.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 bg-[#1A2E52] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#00C2D4]"
                        style={{ width: `${d.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-500 text-xs text-center py-4">No data</div>
            )}
          </div>

          {/* Summary */}
          {stats && (
            <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-4 space-y-2">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Summary</div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Invested</span>
                <span className="text-white">
                  ${(stats.totalValue - stats.cashUSD).toFixed(0)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Cash</span>
                <span className="text-white">${stats.cashUSD.toFixed(0)}</span>
              </div>
              <div className="flex justify-between text-xs border-t border-[#1A2E52] pt-2">
                <span className="text-gray-400">Total Value</span>
                <span className="text-white font-medium">${stats.totalValue.toFixed(0)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Unrealized P&L</span>
                <span className={totalPnL >= 0 ? "text-green-400" : "text-red-400"}>
                  {totalPnL >= 0 ? "+" : ""}${totalPnL.toFixed(0)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <AddPositionModal
        open={modalOpen}
        onClose={handleCloseModal}
        editPosition={editPosition}
      />
    </div>
  )
}
