"use client"

import { useState, useEffect, useCallback } from "react"
import { AlertTriangle, Shield, RefreshCw, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { usePortfolioStore } from "@/store/portfolioStore"
import { chatWithAdvisor } from "@/lib/claude"
import { detectMarketRegime, type MarketRegime } from "@/lib/marketRegime"
import type { Position, PortfolioStats } from "@/types"
import { InlineSpinner } from "@/components/ui/LoadingSpinner"
import { HSRHeroBanner } from "@/components/hsr/HSRHeroBanner"
import { PAGE_CHARACTERS } from "@/components/hsr/characters"
import ReactMarkdown from "react-markdown"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"

const STRESS_SCENARIOS = [
  { label: "Bull +20%",      multiplier: 1.2,  spMultiplier: 1.2,  color: "text-green-400" },
  { label: "Base +5%",       multiplier: 1.07, spMultiplier: 1.05, color: "text-blue-400" },
  { label: "Bear -20%",      multiplier: 0.82, spMultiplier: 0.8,  color: "text-red-400" },
  { label: "Crash -40%",     multiplier: 0.65, spMultiplier: 0.6,  color: "text-red-600" },
  { label: "AI Bust",        multiplier: 0.55, spMultiplier: 0.75, color: "text-orange-400" },
  { label: "Inflation Spike",multiplier: 0.85, spMultiplier: 0.88, color: "text-yellow-400" },
]

const PLAYBOOKS = [
  { label: "📉 If market drops 10%",        key: "drop10" },
  { label: "📈 If inflation spikes again",  key: "inflation" },
  { label: "🤖 If AI narrative breaks",     key: "aibreak" },
  { label: "📉 If recession confirmed",     key: "recession" },
  { label: "🌍 If geopolitical crisis",     key: "geopolitical" },
]

function buildContext(positions: Position[], stats: PortfolioStats | null, regime?: MarketRegime | null) {
  if (!stats) return ""
  return `Portfolio Value: $${stats.totalValue.toFixed(0)}
Cash: $${stats.cashUSD.toFixed(0)} (${((stats.cashUSD / stats.totalValue) * 100).toFixed(1)}%)
Market Regime: ${regime?.regime || "Unknown"} (VIX ${regime?.vix.level.toFixed(2) || "?"})
Positions: ${positions.map((p: Position) => `${p.ticker} (${p.category}, ${((p.shares * p.currentPrice / stats.totalValue) * 100).toFixed(1)}%)`).join(", ")}`
}

function regimeColors(regime: string) {
  if (regime === "RISK-ON BULL")  return { text: "text-emerald-400", border: "border-emerald-500/40", bg: "bg-emerald-500/10" }
  if (regime === "NEUTRAL")       return { text: "text-cyan-400",    border: "border-cyan-500/40",    bg: "bg-cyan-500/10" }
  if (regime === "CAUTION")       return { text: "text-yellow-400",  border: "border-yellow-500/40",  bg: "bg-yellow-500/10" }
  if (regime === "RISK-OFF BEAR") return { text: "text-orange-400",  border: "border-orange-500/40",  bg: "bg-orange-500/10" }
  return                              { text: "text-red-400",     border: "border-red-500/40",     bg: "bg-red-500/10" }
}

function SignalIcon({ status }: { status: "bullish" | "bearish" | "neutral" }) {
  if (status === "bullish") return <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
  if (status === "bearish") return <TrendingDown className="w-3.5 h-3.5 text-red-400" />
  return <Minus className="w-3.5 h-3.5 text-gray-500" />
}

export default function StrategyPage() {
  const { positions, stats } = usePortfolioStore()
  const [playbook, setPlaybook] = useState<Record<string, string>>({})
  const [loadingPlaybook, setLoadingPlaybook] = useState<string | null>(null)
  const [regime, setRegime] = useState<MarketRegime | null>(null)
  const [regimeLoading, setRegimeLoading] = useState(false)

  const activePositions = positions.filter((p) => p.isActive && p.category !== "watchlist")
  const totalInvested = activePositions.reduce((s, p) => s + p.shares * p.currentPrice, 0)
  const totalCash = stats?.cashUSD || 0
  const totalPortfolio = totalInvested + totalCash
  const character = PAGE_CHARACTERS.strategy

  const refreshRegime = useCallback(async () => {
    setRegimeLoading(true)
    try {
      const r = await detectMarketRegime()
      setRegime(r)
    } finally {
      setRegimeLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshRegime()
    const interval = setInterval(refreshRegime, 5 * 60 * 1000) // 5 min
    return () => clearInterval(interval)
  }, [refreshRegime])

  async function loadPlaybook(key: string, label: string) {
    setLoadingPlaybook(key)
    try {
      const context = buildContext(activePositions, stats, regime)
      const prompt = `Given this portfolio and current market regime: ${context}

What should I do if: "${label}"?

Give me specific, actionable guidance:
- Which positions to BUY (with prices)
- Which positions to HOLD (with reasons)
- Which positions to TRIM (with triggers)
- Cash level target
- Priority order of actions`

      const response = await chatWithAdvisor(
        [{ id: "1", role: "user", content: prompt, timestamp: Date.now() }],
        context
      )
      setPlaybook((prev) => ({ ...prev, [key]: response }))
    } catch {
      setPlaybook((prev) => ({ ...prev, [key]: "Analysis unavailable. Check API key in Settings." }))
    } finally {
      setLoadingPlaybook(null)
    }
  }

  // Portfolio internal risks (these are separate from market regime)
  const highSpeculative = (stats?.allocation?.speculative || 0) > 20
  const lowCash = (stats?.allocation?.cash || 0) < 5
  const highConcentration = activePositions.some(
    (p) => stats && (p.shares * p.currentPrice) / stats.totalValue > 0.3
  )

  const rcolors = regime ? regimeColors(regime.regime) : { text: "text-gray-400", border: "border-gray-700", bg: "bg-gray-800/30" }

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      {/* ── HSR Hero Banner ─────────────────────────── */}
      <HSRHeroBanner character={character} title="Strategy" height="h-40">
        <div className="text-[10px] tracking-[0.2em] uppercase font-semibold mb-1" style={{ color: character.color }}>
          {character.role}
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">Strategy</h1>
        <div className="text-xs text-gray-400 mb-2">
          Real-time market regime · VIX · SPY trend · position sizing
        </div>
        {regime && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("text-xs font-bold px-2 py-1 rounded border", rcolors.bg, rcolors.border, rcolors.text)}>
              {regime.regime}
            </span>
            <span className="text-xs text-gray-500">Score {regime.score}/100</span>
            <span className="text-xs text-gray-500">·</span>
            <span className="text-xs text-gray-500">VIX {regime.vix.level.toFixed(2)}</span>
            <button onClick={refreshRegime} disabled={regimeLoading} className="text-xs text-cyan-400 hover:text-cyan-200 ml-2 flex items-center gap-1">
              <RefreshCw className={cn("w-3 h-3", regimeLoading && "animate-spin")} />
              Refresh
            </button>
          </div>
        )}
      </HSRHeroBanner>

      {/* ── Market Regime + Position Sizing ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4 mb-4">
        {/* Market Regime Card */}
        <div className={cn("bg-[#0C1628] border rounded-2xl p-5 hsr-card", rcolors.border)}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">Current Market Regime</div>
              <div className={cn("text-3xl font-bold", rcolors.text)}>{regime?.regime || "Loading…"}</div>
              {regime && (
                <div className="text-xs text-gray-400 mt-1">{regime.summary}</div>
              )}
            </div>
            {regime && (
              <div className="text-right">
                <div className="text-[10px] text-gray-500 uppercase">Regime Score</div>
                <div className={cn("text-3xl font-bold", rcolors.text)}>{regime.score}</div>
                <div className="text-[10px] text-gray-600">/100</div>
              </div>
            )}
          </div>

          {/* Market Signals */}
          {regime && (
            <div className="space-y-1.5 mt-3 pt-3 border-t border-[#1A2E52]/60">
              {regime.signals.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <SignalIcon status={s.status} />
                  <span className="text-gray-400 font-medium w-24">{s.label}:</span>
                  <span className={cn(
                    "flex-1 font-mono",
                    s.status === "bullish" ? "text-emerald-300" :
                    s.status === "bearish" ? "text-red-300" : "text-gray-300"
                  )}>
                    {s.detail}
                  </span>
                </div>
              ))}
              <div className="text-[10px] text-gray-600 pt-2">
                Last updated {formatDistanceToNow(regime.scannedAt, { addSuffix: true })} · auto-refresh every 5 min
              </div>
            </div>
          )}

          {regimeLoading && !regime && (
            <div className="flex items-center gap-2 text-xs text-gray-500 py-4">
              <InlineSpinner /> Fetching real-time market data (VIX, SPY, QQQ, TLT)…
            </div>
          )}
        </div>

        {/* Position Sizing — guided by regime */}
        <div className="bg-[#0C1628] border border-[#1A2E52] rounded-2xl p-5 hsr-card">
          <div className="text-xs text-gray-500 uppercase tracking-widest mb-3">Position Sizing</div>

          {regime && (
            <div className={cn("rounded-lg p-3 mb-3 border", rcolors.bg, rcolors.border)}>
              <div className="text-xs text-gray-400 mb-0.5">Regime Bias</div>
              <div className={cn("text-base font-bold", rcolors.text)}>{regime.positionGuidance.bias}</div>
              <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                <div>
                  <div className="text-gray-500">Max Exposure</div>
                  <div className="text-white font-semibold">{regime.positionGuidance.maxExposure}%</div>
                </div>
                <div>
                  <div className="text-gray-500">Cash Target</div>
                  <div className="text-white font-semibold">{regime.positionGuidance.cashTarget}%</div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2 text-xs">
            {[
              { cat: "Core 💎",        max: 15, color: "#00C2D4" },
              { cat: "Defensive 🛡️",   max: 10, color: "#22c55e" },
              { cat: "Satellite 🛸",    max: 10, color: "#3b82f6" },
              { cat: "Speculative 🎯",  max: 5,  color: "#f59e0b" },
              { cat: "ETF 💰",         max: 15, color: "#06b6d4" },
            ].map((row) => (
              <div key={row.cat} className="flex items-center justify-between border-b border-[#1A2E52]/40 last:border-0 py-1">
                <span className="text-gray-400">{row.cat}</span>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500">max {row.max}%</span>
                  <span className="text-white font-medium">${(totalPortfolio * row.max / 100).toFixed(0)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Portfolio Internal Risks ──────────────────────────────── */}
      {(highSpeculative || lowCash || highConcentration) && (
        <div className="bg-yellow-500/5 border border-yellow-500/30 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-semibold text-yellow-400">Portfolio Internal Risks</span>
          </div>
          <div className="space-y-1 text-xs">
            {highConcentration && (
              <div className="flex items-center gap-1 text-red-400">
                <AlertTriangle className="w-3 h-3" /> Single position &gt;30% of portfolio
              </div>
            )}
            {highSpeculative && (
              <div className="flex items-center gap-1 text-yellow-400">
                <AlertTriangle className="w-3 h-3" /> Speculative allocation &gt;20%
              </div>
            )}
            {lowCash && (
              <div className="flex items-center gap-1 text-yellow-400">
                <AlertTriangle className="w-3 h-3" /> Cash below 5% — limited dry powder
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Stress Test ─────────────────────────────────────────── */}
      <div className="bg-[#0C1628] border border-[#1A2E52] rounded-2xl p-5 mb-4 hsr-card">
        <div className="text-xs text-gray-500 uppercase tracking-widest mb-4">Portfolio Stress Test</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1A2E52]">
                <th className="text-left text-gray-500 font-normal pb-2">Scenario</th>
                <th className="text-right text-gray-500 font-normal pb-2">Your Portfolio</th>
                <th className="text-right text-gray-500 font-normal pb-2">S&P 500</th>
                <th className="text-right text-gray-500 font-normal pb-2">Est. Value</th>
              </tr>
            </thead>
            <tbody>
              {STRESS_SCENARIOS.map((s) => {
                const portPct = ((s.multiplier - 1) * 100).toFixed(1)
                const spPct = ((s.spMultiplier - 1) * 100).toFixed(1)
                const estValue = totalPortfolio * s.multiplier
                const isPositive = s.multiplier > 1
                return (
                  <tr key={s.label} className="border-b border-[#1A2E52] last:border-0">
                    <td className="py-2.5"><span className={s.color}>{s.label}</span></td>
                    <td className={`text-right py-2.5 font-medium ${isPositive ? "text-green-400" : "text-red-400"}`}>
                      {isPositive ? "+" : ""}{portPct}%
                    </td>
                    <td className="text-right py-2.5 text-gray-400">
                      {parseFloat(spPct) > 0 ? "+" : ""}{spPct}%
                    </td>
                    <td className="text-right py-2.5 text-gray-300">${estValue.toFixed(0)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Rebalancing ─────────────────────────────────────────── */}
      {stats && (
        <div className="bg-[#0C1628] border border-[#1A2E52] rounded-2xl p-5 mb-4 hsr-card">
          <div className="text-xs text-gray-500 uppercase tracking-widest mb-3">Rebalancing Check</div>
          <div className="space-y-2">
            {activePositions.map((p) => {
              const weight = (p.shares * p.currentPrice / totalPortfolio) * 100
              const maxWeight = 20
              const isOverweight = weight > maxWeight
              if (!isOverweight) return null
              return (
                <div key={p.id} className="flex items-center justify-between text-sm bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-400" />
                    <span className="text-white">{p.ticker}</span>
                    <span className="text-gray-400">is overweight</span>
                  </div>
                  <div className="text-yellow-400">{weight.toFixed(1)}% (max {maxWeight}%)</div>
                </div>
              )
            })}
            {!activePositions.some((p) => (p.shares * p.currentPrice / totalPortfolio) * 100 > 20) && (
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <Shield className="w-4 h-4" /> All positions within target allocation
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Crisis Playbooks ────────────────────────────────────── */}
      <div className="bg-[#0C1628] border border-[#1A2E52] rounded-2xl p-5 hsr-card">
        <div className="text-xs text-gray-500 uppercase tracking-widest mb-4">Crisis Playbooks</div>
        <div className="space-y-3">
          {PLAYBOOKS.map((pb) => (
            <div key={pb.key} className="border border-[#1A2E52] rounded-lg overflow-hidden">
              <div className="flex items-center justify-between p-3">
                <div className="text-sm font-medium text-white">{pb.label}</div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => loadPlaybook(pb.key, pb.label)}
                  disabled={loadingPlaybook === pb.key}
                  className="border-[#1F3566] text-gray-300 text-xs"
                >
                  {loadingPlaybook === pb.key ? (
                    <><InlineSpinner className="mr-1" />Loading...</>
                  ) : (
                    playbook[pb.key] ? "Refresh" : "Get Strategy →"
                  )}
                </Button>
              </div>
              {playbook[pb.key] && (
                <div className="px-4 pb-4 border-t border-[#1A2E52] prose prose-sm prose-invert max-w-none text-gray-300 text-xs">
                  <ReactMarkdown>{playbook[pb.key]}</ReactMarkdown>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
