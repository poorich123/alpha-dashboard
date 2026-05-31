"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Activity, TrendingUp, TrendingDown, RefreshCw, AlertTriangle,
  Building2, BarChart3, Info,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { HSRHeroBanner } from "@/components/hsr/HSRHeroBanner"
import { PAGE_CHARACTERS } from "@/components/hsr/characters"
import { InlineSpinner } from "@/components/ui/LoadingSpinner"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import toast from "react-hot-toast"

import {
  fetchCotHistory, computePositioningZScore, interpretPositioning,
  COT_CONTRACTS, type CotContractKey, type CotRecord,
} from "@/lib/cftcCot"
import { fetchGex, type GexSnapshot } from "@/lib/dealerGamma"
import { fetchHoldings, computeSmartMoneyScore, type HoldingsSnapshot } from "@/lib/institutionalHoldings"

export default function SmartMoneyPage() {
  const character = PAGE_CHARACTERS.smartmoney

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <HSRHeroBanner character={character} title="Smart Money" height="h-44">
        <div className="text-[10px] tracking-[0.2em] uppercase font-semibold mb-1" style={{ color: character.color }}>
          Institutional Intel
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">Smart Money Dashboard</h1>
        <div className="text-xs text-gray-400 mb-3">
          Hedge fund positioning (CFTC COT) · Dealer gamma (options) · 13F institutional holdings
        </div>
        <div className="text-[11px] text-cyan-300/80 max-w-2xl">
          💡 Three data sources hedge funds use to position trades. Watch for extremes (z-score &gt;2 or &lt;-2)
          and zero-gamma flip levels — these are leading indicators of regime changes.
        </div>
      </HSRHeroBanner>

      <div className="space-y-4">
        <CotPanel />
        <GexPanel />
        <HoldingsPanel />
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  1. CFTC COT — Hedge Fund Positioning
// ════════════════════════════════════════════════════════════════════════════

function CotPanel() {
  const [selected, setSelected] = useState<CotContractKey>("sp500")
  const [history, setHistory] = useState<CotRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (key: CotContractKey) => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchCotHistory(key, 26)
      if (data.length === 0) {
        setError(`No COT records returned for ${COT_CONTRACTS[key].label}. Contract may have a different CFTC market name.`)
      }
      setHistory(data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`COT fetch failed: ${msg}`)
      toast.error("COT fetch failed")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(selected) }, [selected, load])

  const netHistory = history.map(r => r.levFundNet)
  const z = computePositioningZScore(netHistory)
  const interp = interpretPositioning(z)
  const latest = history[0]

  return (
    <div className="bg-[#0C1628] border border-[#1A2E52] rounded-2xl overflow-hidden hsr-card">
      {/* Header */}
      <div className="bg-[#0A1424] border-b border-[#1A2E52] px-4 py-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-purple-400" />
          <div>
            <div className="text-sm font-bold text-white">1. CFTC COT · Hedge Fund Positioning</div>
            <div className="text-[10px] text-gray-500">
              Leveraged Funds = hedge funds & CTAs · weekly · updated Friday 3:30 PM ET
            </div>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => load(selected)}
          disabled={loading}
          className="border-[#1F3566] text-gray-300 gap-1 h-7 text-xs"
        >
          {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Refresh
        </Button>
      </div>

      {/* Contract chips */}
      <div className="px-4 py-2 border-b border-[#1A2E52]/60 flex flex-wrap gap-1.5">
        {(Object.keys(COT_CONTRACTS) as CotContractKey[]).map(k => {
          const c = COT_CONTRACTS[k]
          return (
            <button
              key={k}
              onClick={() => setSelected(k)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
                selected === k
                  ? "bg-purple-500/15 text-purple-300 border border-purple-500/40"
                  : "text-gray-400 hover:bg-[#1A2E52]/40 border border-transparent",
              )}
            >
              {c.emoji} {c.label}
            </button>
          )
        })}
      </div>

      {/* Body */}
      {loading && history.length === 0 ? (
        <div className="flex items-center justify-center py-10">
          <InlineSpinner className="text-purple-400 w-5 h-5" />
          <span className="ml-2 text-gray-500 text-sm">Loading CFTC data…</span>
        </div>
      ) : error ? (
        <div className="px-4 py-6 text-center">
          <div className="text-red-400 text-sm mb-1">⚠️ {error}</div>
          <div className="text-[10px] text-gray-600">Try a different contract or refresh — CFTC API may be temporarily unavailable</div>
        </div>
      ) : !latest ? (
        <div className="py-10 text-center text-gray-500 text-sm">No data available</div>
      ) : (
        <div className="p-4 space-y-4">
          {/* Top signal */}
          <div className={cn(
            "rounded-xl border p-4",
            interp.signal === "EXTREME LONG" || interp.signal === "EXTREME SHORT"
              ? "border-red-500/40 bg-red-500/5"
              : interp.signal === "ELEVATED LONG" || interp.signal === "ELEVATED SHORT"
              ? "border-orange-500/40 bg-orange-500/5"
              : "border-[#1A2E52] bg-[#070B18]"
          )}>
            <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">Positioning Signal</div>
                <div className={cn("text-xl font-bold", interp.color)}>{interp.signal}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  z-score: <span className={interp.color}>{z.toFixed(2)}σ</span> over 26 weeks ·
                  Report {latest.reportDate}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">Contrarian Bias</div>
                <div className={cn("text-lg font-bold", interp.color)}>{interp.contrarian}</div>
              </div>
            </div>
            <div className="text-[11px] text-gray-300 leading-relaxed flex items-start gap-1.5">
              <Info className="w-3 h-3 text-cyan-400 mt-0.5 flex-shrink-0" />
              <span>{interp.tip}</span>
            </div>
          </div>

          {/* Position breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <CategoryCell
              label="Lev Funds (HF)"
              long={latest.levFundLong}
              short={latest.levFundShort}
              change={latest.levFundLongChange ?? 0 - (latest.levFundShortChange ?? 0)}
              accent="text-purple-300"
            />
            <CategoryCell
              label="Asset Mgrs"
              long={latest.assetMgrLong}
              short={latest.assetMgrShort}
              accent="text-cyan-300"
            />
            <CategoryCell
              label="Dealers"
              long={latest.dealerLong}
              short={latest.dealerShort}
              accent="text-blue-300"
            />
            <CategoryCell
              label="Retail (non-rept)"
              long={latest.nonReptLong}
              short={latest.nonReptShort}
              accent="text-gray-300"
            />
          </div>

          {/* Mini chart of net positioning trend */}
          <div className="bg-[#070B18] border border-[#1A2E52]/60 rounded-xl p-3">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
              Leveraged Funds Net Position · 26-week trend
            </div>
            <NetPositionChart history={history.slice(0, 26).reverse()} />
          </div>
        </div>
      )}
    </div>
  )
}

function CategoryCell({
  label, long, short, change, accent,
}: { label: string; long: number; short: number; change?: number; accent: string }) {
  const net = long - short
  const fmt = (n: number) => Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toFixed(0)
  return (
    <div className="bg-[#070B18] border border-[#1A2E52]/60 rounded-lg p-2.5">
      <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={cn("text-sm font-bold font-mono", accent)}>
        {net >= 0 ? "+" : ""}{fmt(net)}
      </div>
      <div className="text-[9px] text-gray-600 mt-0.5">
        L {fmt(long)} · S {fmt(short)}
      </div>
      {change !== undefined && change !== 0 && (
        <div className={cn("text-[9px] mt-0.5", change > 0 ? "text-emerald-400" : "text-red-400")}>
          Δ {change > 0 ? "+" : ""}{fmt(change)}
        </div>
      )}
    </div>
  )
}

function NetPositionChart({ history }: { history: CotRecord[] }) {
  if (history.length === 0) return null
  const W = 700, H = 80
  const nets = history.map(r => r.levFundNet)
  const max = Math.max(...nets)
  const min = Math.min(...nets)
  const range = max - min || 1
  const xStep = W / Math.max(1, history.length - 1)
  const points = nets.map((n, i) => ({
    x: i * xStep,
    y: H - ((n - min) / range) * H,
    val: n,
  }))
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")
  const zeroY = H - ((0 - min) / range) * H

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 80 }}>
      {/* Zero line if in range */}
      {min < 0 && max > 0 && (
        <line x1="0" y1={zeroY} x2={W} y2={zeroY} stroke="#374151" strokeWidth="0.5" strokeDasharray="3,3" />
      )}
      <path d={path} fill="none" stroke="#a855f7" strokeWidth="1.5" />
      {/* End-point dot */}
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="3" fill="#a855f7" />
    </svg>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  2. Dealer Gamma (GEX)
// ════════════════════════════════════════════════════════════════════════════

const GEX_SYMBOLS = ["SPY", "QQQ", "IWM"] as const

function GexPanel() {
  const [symbol, setSymbol] = useState<typeof GEX_SYMBOLS[number]>("SPY")
  const [snap, setSnap] = useState<GexSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (sym: string) => {
    setLoading(true)
    setError(null)
    try {
      const s = await fetchGex(sym)
      setSnap(s)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`Yahoo options API: ${msg}. Crumb auth may have expired — server will retry on next request.`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(symbol) }, [symbol, load])

  return (
    <div className="bg-[#0C1628] border border-[#1A2E52] rounded-2xl overflow-hidden hsr-card">
      <div className="bg-[#0A1424] border-b border-[#1A2E52] px-4 py-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-cyan-400" />
          <div>
            <div className="text-sm font-bold text-white">2. Dealer Gamma (GEX)</div>
            <div className="text-[10px] text-gray-500">
              Options dealer positioning · derived from Yahoo options chain · zero-gamma = key pivot
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {GEX_SYMBOLS.map(s => (
            <button
              key={s}
              onClick={() => setSymbol(s)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
                symbol === s
                  ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/40"
                  : "text-gray-400 hover:bg-[#1A2E52]/40 border border-transparent",
              )}
            >
              {s}
            </button>
          ))}
          <Button
            size="sm"
            variant="outline"
            onClick={() => load(symbol)}
            disabled={loading}
            className="border-[#1F3566] text-gray-300 gap-1 h-7 text-xs ml-1"
          >
            <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {loading && !snap ? (
        <div className="flex items-center justify-center py-10">
          <InlineSpinner className="text-cyan-400 w-5 h-5" />
          <span className="ml-2 text-gray-500 text-sm">Computing dealer gamma…</span>
        </div>
      ) : error ? (
        <div className="px-4 py-6 text-center">
          <div className="text-red-400 text-sm mb-1">⚠️ {error}</div>
          <div className="text-[10px] text-gray-600 max-w-md mx-auto">
            Yahoo&apos;s options endpoint now requires crumb authentication. The server attempts
            to fetch+cache this automatically — try the Refresh button or wait 1 min.
          </div>
        </div>
      ) : !snap ? (
        <div className="py-10 text-center text-gray-500 text-sm">No data</div>
      ) : (
        <div className="p-4 space-y-3">
          {/* Regime banner */}
          <div className={cn(
            "rounded-xl border p-3 flex items-start gap-3",
            snap.regime === "POSITIVE GEX" ? "border-emerald-500/40 bg-emerald-500/5" :
            snap.regime === "NEGATIVE GEX" ? "border-red-500/40 bg-red-500/5" :
                                              "border-yellow-500/40 bg-yellow-500/5"
          )}>
            <AlertTriangle className={cn(
              "w-4 h-4 flex-shrink-0 mt-0.5",
              snap.regime === "POSITIVE GEX" ? "text-emerald-400" :
              snap.regime === "NEGATIVE GEX" ? "text-red-400" : "text-yellow-400"
            )} />
            <div className="flex-1">
              <div className={cn(
                "text-sm font-bold",
                snap.regime === "POSITIVE GEX" ? "text-emerald-300" :
                snap.regime === "NEGATIVE GEX" ? "text-red-300" : "text-yellow-300"
              )}>
                {snap.regime} · Total GEX = ${(snap.totalGex / 1e9).toFixed(2)}B
              </div>
              <div className="text-[11px] text-gray-300 mt-1 leading-relaxed">{snap.regimeTip}</div>
            </div>
          </div>

          {/* Key levels grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <KeyLevel label="Spot" value={`$${snap.spotPrice.toFixed(2)}`} sub="Current" color="text-white" />
            <KeyLevel
              label="Zero Gamma"
              value={snap.zeroGammaLevel ? `$${snap.zeroGammaLevel.toFixed(2)}` : "—"}
              sub="Regime flip point"
              color="text-yellow-300"
            />
            <KeyLevel
              label="Top Call Wall"
              value={snap.topCallWall ? `$${snap.topCallWall.strike.toFixed(2)}` : "—"}
              sub="Resistance"
              color="text-emerald-300"
            />
            <KeyLevel
              label="Top Put Wall"
              value={snap.topPutWall ? `$${snap.topPutWall.strike.toFixed(2)}` : "—"}
              sub="Support"
              color="text-red-300"
            />
          </div>

          {/* GEX by strike chart */}
          <div className="bg-[#070B18] border border-[#1A2E52]/60 rounded-xl p-3">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
              Net GEX by Strike (positive = support · negative = resistance)
            </div>
            <GexChart snap={snap} />
          </div>

          <div className="text-[10px] text-gray-600">
            Computed {formatDistanceToNow(snap.asOf, { addSuffix: true })} ·
            Based on next ~3 expirations
          </div>
        </div>
      )}
    </div>
  )
}

function KeyLevel({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="bg-[#070B18] border border-[#1A2E52]/60 rounded-lg p-2.5">
      <div className="text-[9px] text-gray-500 uppercase tracking-wider">{label}</div>
      <div className={cn("text-sm font-bold font-mono", color)}>{value}</div>
      <div className="text-[9px] text-gray-600 mt-0.5">{sub}</div>
    </div>
  )
}

function GexChart({ snap }: { snap: GexSnapshot }) {
  const strikes = snap.strikes
  if (strikes.length === 0) return null
  const W = 720, H = 140
  const max = Math.max(...strikes.map(s => Math.max(Math.abs(s.netGex), 1)))
  const xStep = W / strikes.length
  const midY = H / 2

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 140 }}>
      <line x1="0" y1={midY} x2={W} y2={midY} stroke="#374151" strokeWidth="0.5" />
      {strikes.map((s, i) => {
        const barH = (Math.abs(s.netGex) / max) * (H / 2 - 5)
        const isPositive = s.netGex >= 0
        const y = isPositive ? midY - barH : midY
        return (
          <rect
            key={s.strike}
            x={i * xStep}
            y={y}
            width={Math.max(1, xStep * 0.7)}
            height={Math.max(0.5, barH)}
            fill={isPositive ? "#10b981" : "#ef4444"}
            opacity="0.7"
          />
        )
      })}
      {/* Spot price marker */}
      {(() => {
        const spotIdx = strikes.findIndex(s => s.strike >= snap.spotPrice)
        if (spotIdx < 0) return null
        const x = spotIdx * xStep
        return <line x1={x} y1="0" x2={x} y2={H} stroke="#ffffff" strokeWidth="1" strokeDasharray="2,2" opacity="0.8" />
      })()}
    </svg>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  3. Institutional Holdings (13F proxy)
// ════════════════════════════════════════════════════════════════════════════

function HoldingsPanel() {
  const [ticker, setTicker] = useState("NVDA")
  const [input, setInput] = useState("NVDA")
  const [snap, setSnap] = useState<HoldingsSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (t: string) => {
    setLoading(true)
    setError(null)
    try {
      const s = await fetchHoldings(t)
      setSnap(s)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`Yahoo holdings API: ${msg}. Crumb auth required.`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(ticker) }, [ticker, load])

  const smartScore = snap ? computeSmartMoneyScore(snap) : null

  return (
    <div className="bg-[#0C1628] border border-[#1A2E52] rounded-2xl overflow-hidden hsr-card">
      <div className="bg-[#0A1424] border-b border-[#1A2E52] px-4 py-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-amber-400" />
          <div>
            <div className="text-sm font-bold text-white">3. Institutional Holdings (13F proxy)</div>
            <div className="text-[10px] text-gray-500">
              Top fund holders + smart money score · 45-day filing delay · quarterly
            </div>
          </div>
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); setTicker(input.trim().toUpperCase()) }}
          className="flex gap-1"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ticker"
            className="w-24 bg-[#070B18] border border-[#1A2E52] rounded px-2 py-1 text-xs text-white font-mono"
          />
          <Button
            size="sm"
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 h-7 text-xs"
          >
            Look up
          </Button>
        </form>
      </div>

      {loading && !snap ? (
        <div className="flex items-center justify-center py-10">
          <InlineSpinner className="text-amber-400 w-5 h-5" />
          <span className="ml-2 text-gray-500 text-sm">Fetching 13F data…</span>
        </div>
      ) : error ? (
        <div className="px-4 py-6 text-center">
          <div className="text-red-400 text-sm mb-1">⚠️ {error}</div>
          <div className="text-[10px] text-gray-600">Yahoo&apos;s quoteSummary endpoint requires authentication. Server will retry — refresh in 1 min.</div>
        </div>
      ) : !snap ? (
        <div className="py-10 text-center text-gray-500 text-sm">No data</div>
      ) : (
        <div className="p-4 space-y-3">
          {/* Smart money score */}
          {smartScore && (
            <div className={cn(
              "rounded-xl border p-3 flex items-start gap-3",
              smartScore.signal === "STRONG" ? "border-emerald-500/40 bg-emerald-500/5" :
              smartScore.signal === "MODERATE" ? "border-yellow-500/40 bg-yellow-500/5" :
                                                  "border-gray-700 bg-gray-800/30"
            )}>
              <div className="text-2xl font-bold font-mono">
                <span className={cn(
                  smartScore.signal === "STRONG" ? "text-emerald-300" :
                  smartScore.signal === "MODERATE" ? "text-yellow-300" : "text-gray-400"
                )}>{smartScore.score}</span>
                <span className="text-gray-600 text-sm">/100</span>
              </div>
              <div className="flex-1">
                <div className={cn(
                  "text-sm font-bold mb-1",
                  smartScore.signal === "STRONG" ? "text-emerald-300" :
                  smartScore.signal === "MODERATE" ? "text-yellow-300" : "text-gray-400"
                )}>
                  Smart Money Score: {smartScore.signal}
                </div>
                <ul className="text-[11px] text-gray-400 space-y-0.5">
                  {smartScore.reasons.map((r, i) => (
                    <li key={i}>· {r}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Breakdown */}
          {snap.breakdown && (
            <div className="grid grid-cols-3 gap-2">
              <KeyLevel
                label="Institutional"
                value={`${(snap.breakdown.institutionsPct * 100).toFixed(1)}%`}
                sub={`${snap.breakdown.institutionsCount.toLocaleString()} funds`}
                color="text-amber-300"
              />
              <KeyLevel
                label="Insider"
                value={`${(snap.breakdown.insidersPct * 100).toFixed(2)}%`}
                sub="Alignment"
                color="text-emerald-300"
              />
              <KeyLevel
                label="Inst % of Float"
                value={`${(snap.breakdown.floatPct * 100).toFixed(1)}%`}
                sub="Effective control"
                color="text-cyan-300"
              />
            </div>
          )}

          {/* Top holders */}
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
              Top 10 Holders · most recent 13F
            </div>
            <div className="bg-[#070B18] border border-[#1A2E52]/60 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-[#0A1424]">
                  <tr className="text-[10px] text-gray-500 uppercase">
                    <th className="text-left px-3 py-1.5">#</th>
                    <th className="text-left px-3 py-1.5">Fund</th>
                    <th className="text-right px-3 py-1.5">% Held</th>
                    <th className="text-right px-3 py-1.5">Shares</th>
                    <th className="text-right px-3 py-1.5">Value</th>
                    <th className="text-right px-3 py-1.5">Filed</th>
                  </tr>
                </thead>
                <tbody>
                  {snap.topHolders.map((h, i) => (
                    <tr key={i} className="border-t border-[#1A2E52]/40 hover:bg-amber-500/[0.04]">
                      <td className="px-3 py-1.5 text-gray-600">{i + 1}</td>
                      <td className="px-3 py-1.5 text-white">{h.organization}</td>
                      <td className="px-3 py-1.5 text-right text-amber-300 font-mono">
                        {(h.pctHeld * 100).toFixed(2)}%
                      </td>
                      <td className="px-3 py-1.5 text-right text-gray-400 font-mono">
                        {h.position.toLocaleString()}
                      </td>
                      <td className="px-3 py-1.5 text-right text-cyan-300 font-mono">
                        ${(h.value / 1e9).toFixed(2)}B
                      </td>
                      <td className="px-3 py-1.5 text-right text-gray-600">{h.reportDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-[10px] text-gray-600 leading-relaxed">
            ⚠️ <strong>Note:</strong> 13F filings lag actual trades by 45 days (filed quarterly).
            For real-time prime brokerage data, you&apos;d need an institutional account (not available
            to retail). This is the closest free proxy.
          </div>
        </div>
      )}
    </div>
  )
}
