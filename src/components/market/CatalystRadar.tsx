"use client"

import { useState, useCallback } from "react"
import { Radar, RefreshCw, ExternalLink, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  scanCatalysts, scanCatalystsUniverse, type CatalystSignal,
} from "@/lib/catalystRadar"
import { SPECULATIVE_MOMENTUM, SP500, NYSE_INTERESTING } from "@/lib/stockLists"
import { usePortfolioStore } from "@/store/portfolioStore"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import toast from "react-hot-toast"

type ScanMode = "quick" | "deep" | "holdings"

export function CatalystRadar() {
  const positions = usePortfolioStore(s => s.positions)
  const [mode, setMode] = useState<ScanMode>("quick")
  const [scanning, setScanning] = useState(false)
  const [signals, setSignals] = useState<CatalystSignal[]>([])
  const [progress, setProgress] = useState({ done: 0, total: 0, phase: "scan" as "prefilter" | "scan" })
  const [meta, setMeta] = useState<{ candidates: number; universe: number } | null>(null)
  const [open, setOpen] = useState(true)
  const [lastScannedAt, setLastScannedAt] = useState<number | null>(null)
  const [showWeak, setShowWeak] = useState(false)

  const runScan = useCallback(async () => {
    setScanning(true)
    setProgress({ done: 0, total: 0, phase: "prefilter" })
    setMeta(null)

    try {
      const holdings = positions
        .filter(p => p.isActive)
        .map(p => p.ticker.toUpperCase())

      let results: CatalystSignal[] = []

      if (mode === "holdings") {
        // Direct per-ticker scan — small list, can afford individual Finnhub calls
        if (holdings.length === 0) {
          toast("No holdings to scan", { icon: "📭" })
          return
        }
        setProgress({ done: 0, total: holdings.length, phase: "scan" })
        results = await scanCatalysts(holdings, {
          topN: holdings.length,
          onProgress: (d, t) => setProgress({ done: d, total: t, phase: "scan" }),
        })
        setMeta({ candidates: holdings.length, universe: holdings.length })
      } else {
        // Universe scan with news-prefilter (efficient pro approach)
        const universe = mode === "deep"
          ? [...new Set([...SP500, ...NYSE_INTERESTING, ...SPECULATIVE_MOMENTUM])]
          : SPECULATIVE_MOMENTUM
        const r = await scanCatalystsUniverse(universe, {
          topN: 30,  // include weak signals (UI splits at score 50)
          alwaysInclude: holdings,
          onProgress: (d, t, phase) => setProgress({ done: d, total: t, phase }),
        })
        results = r.signals
        setMeta({ candidates: r.candidatesScanned, universe: r.universeSize })
      }

      setSignals(results)
      setLastScannedAt(Date.now())

      const strong = results.filter(s => s.score >= 50).length
      const weak = results.length - strong
      if (results.length === 0) {
        toast("No active catalysts found — quiet market", { icon: "🌙" })
      } else if (strong === 0) {
        toast(`${weak} lower-confidence candidates · no strong catalysts`, { icon: "🟡" })
      } else {
        toast.success(`${strong} strong catalyst${strong > 1 ? "s" : ""}${weak > 0 ? ` + ${weak} weak` : ""}`)
      }
    } catch (err) {
      toast.error("Catalyst scan failed")
      console.error(err)
    } finally {
      setScanning(false)
    }
  }, [mode, positions])

  return (
    <div className="bg-[#0C1628] border border-fuchsia-500/30 rounded-2xl overflow-hidden hsr-card mb-3">
      {/* Header */}
      <div className="bg-gradient-to-r from-fuchsia-500/10 to-purple-500/5 border-b border-fuchsia-500/20 px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-2 text-left"
        >
          <Radar className={cn("w-4 h-4 text-fuchsia-400", scanning && "animate-pulse")} />
          <div>
            <div className="text-sm font-bold text-fuchsia-300">🎯 Catalyst Radar</div>
            <div className="text-[10px] text-gray-500">
              News + volume + gap detection
              {meta && (
                <span className="ml-1 text-gray-600">
                  · {meta.candidates} candidates from {meta.universe} universe
                </span>
              )}
              {lastScannedAt && (
                <span className="ml-1 text-gray-600">
                  · {formatDistanceToNow(lastScannedAt, { addSuffix: true })}
                </span>
              )}
            </div>
          </div>
          {open ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />}
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Mode chips */}
          <div className="flex bg-[#070B18] border border-fuchsia-500/20 rounded-lg p-0.5 text-[10px]">
            {([
              { key: "quick", label: "Quick", tip: "SPEC universe (~190) via news prefilter · ~30s" },
              { key: "deep", label: "Deep", tip: "Full S&P+NYSE+SPEC (~700) via news prefilter · ~3-5min" },
              { key: "holdings", label: "Holdings", tip: "Just your positions + watchlist · ~10s" },
            ] as const).map(m => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                title={m.tip}
                disabled={scanning}
                className={cn(
                  "px-2 py-0.5 rounded font-semibold transition-colors",
                  mode === m.key
                    ? "bg-fuchsia-500/30 text-fuchsia-100"
                    : "text-gray-500 hover:text-gray-300",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>

          <Button
            size="sm"
            onClick={runScan}
            disabled={scanning}
            className="bg-fuchsia-500/20 hover:bg-fuchsia-500/30 border border-fuchsia-500/40 text-fuchsia-200 gap-1 h-8 text-xs"
          >
            {scanning ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Radar className="w-3 h-3" />}
            {scanning ? `${progress.phase === "prefilter" ? "Prefiltering" : `Scanning ${progress.done}/${progress.total}`}…` : "Scan Now"}
          </Button>
        </div>
      </div>

      {open && (
        <>
          {/* Progress bar */}
          {scanning && (
            <div className="px-4 py-2">
              <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
                <span>
                  {progress.phase === "prefilter"
                    ? "📰 Fetching market news + extracting ticker mentions…"
                    : `🎯 Deep-scanning ${progress.done}/${progress.total} candidates…`}
                </span>
              </div>
              <div className="h-1 bg-[#1A2E52] rounded-full overflow-hidden">
                <div
                  className="h-full bg-fuchsia-400 transition-all duration-300"
                  style={{ width: progress.phase === "prefilter" ? "10%" : `${10 + (progress.done / Math.max(1, progress.total)) * 90}%` }}
                />
              </div>
            </div>
          )}

          {/* Empty state — never scanned */}
          {!scanning && signals.length === 0 && !lastScannedAt && (
            <div className="px-4 py-6 text-center">
              <div className="text-xs text-gray-500 mb-2">
                Click <strong className="text-fuchsia-300">Scan Now</strong> to detect live catalysts
              </div>
              <div className="text-[10px] text-gray-600 max-w-lg mx-auto leading-relaxed space-y-1">
                <p>
                  <strong className="text-fuchsia-300">Pro technique:</strong> we fetch all market news first
                  (1 API call), extract ticker mentions, then deep-scan only stocks with news + Yahoo
                  volume/gap data. Reduces 700-ticker universe → ~50 actual scans in seconds.
                </p>
                <p>Catalyst = news in 24h (HIGH/CRITICAL) + volume {">"}2× normal + gap {">"}3%.</p>
              </div>
            </div>
          )}

          {/* Scanned but no signals at all (quiet market) */}
          {!scanning && signals.length === 0 && lastScannedAt && (
            <div className="px-4 py-5 text-center">
              <div className="text-xs text-gray-400 mb-2">🌙 No catalysts found — quiet market</div>
              <div className="text-[10px] text-gray-600 max-w-md mx-auto leading-relaxed">
                Scanned {meta?.candidates ?? 0} candidates with news in last 24h, but none had
                HIGH/CRITICAL impact + elevated volume + price gap. Try again later or switch to
                Deep mode for full S&P+NYSE+SPEC coverage.
              </div>
            </div>
          )}

          {/* Signal cards — split into strong (≥50) vs weak (20-49) */}
          {signals.length > 0 && (() => {
            const strong = signals.filter(s => s.score >= 50)
            const weak = signals.filter(s => s.score < 50)
            return (
              <div>
                {/* Strong section */}
                {strong.length > 0 && (
                  <div className="divide-y divide-fuchsia-500/10">
                    {strong.map(s => (
                      <CatalystCard key={s.ticker} signal={s} />
                    ))}
                  </div>
                )}

                {/* No strong — show banner before weak */}
                {strong.length === 0 && weak.length > 0 && (
                  <div className="bg-yellow-500/5 border-b border-yellow-500/20 px-4 py-2.5 text-[11px] text-yellow-300">
                    🟡 No strong catalysts (score ≥50) — showing {weak.length} lower-confidence candidates below.
                    These have news but lack the volume/gap action that defines a true catalyst.
                  </div>
                )}

                {/* Weak section — collapsible */}
                {weak.length > 0 && (
                  <div>
                    <button
                      onClick={() => setShowWeak(v => !v)}
                      className="w-full px-4 py-2 flex items-center justify-between text-[11px] text-gray-500 hover:bg-fuchsia-500/[0.03] border-t border-fuchsia-500/10 transition-colors"
                    >
                      <span>
                        🟡 Lower confidence ({weak.length}) · news only, no vol/gap action
                      </span>
                      {showWeak ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                    {showWeak && (
                      <div className="divide-y divide-fuchsia-500/10 opacity-75">
                        {weak.map(s => (
                          <CatalystCard key={s.ticker} signal={s} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })()}
        </>
      )}
    </div>
  )
}

function CatalystCard({ signal: s }: { signal: CatalystSignal }) {
  const actionColor =
    s.action === "LONG"  ? "text-emerald-400 bg-emerald-500/15 border-emerald-500/40" :
    s.action === "SHORT" ? "text-red-400 bg-red-500/15 border-red-500/40" :
                           "text-gray-400 bg-gray-500/15 border-gray-700"

  const scoreColor =
    s.score >= 80 ? "text-fuchsia-300 bg-fuchsia-500/20" :
    s.score >= 65 ? "text-orange-300 bg-orange-500/20" :
                    "text-yellow-300 bg-yellow-500/15"

  return (
    <div className="px-4 py-3 hover:bg-fuchsia-500/[0.04] transition-colors">
      <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
        <div className="flex items-center gap-3">
          <a
            href={`/analyzer?ticker=${s.ticker}`}
            className="text-base font-bold text-white hover:text-fuchsia-300 transition-colors"
          >
            {s.ticker}
          </a>
          <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", actionColor)}>
            {s.action}
          </span>
          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded font-mono", scoreColor)}>
            {s.score}/100
          </span>
        </div>

        <div className="text-right text-[10px] text-gray-500 font-mono">
          <div>${s.currentPrice.toFixed(2)} · gap {s.gapPct >= 0 ? "+" : ""}{s.gapPct.toFixed(1)}%</div>
          <div className="text-gray-600">vol {s.volumeRatio.toFixed(1)}×</div>
        </div>
      </div>

      {/* Reasons */}
      <ul className="text-[11px] text-gray-300 space-y-0.5 mb-2">
        {s.reasons.map((r, i) => (
          <li key={i} className="leading-relaxed">{r}</li>
        ))}
      </ul>

      {/* Top headline link */}
      {s.topHeadline && (
        <a
          href={s.topHeadline.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[10px] text-fuchsia-400 hover:text-fuchsia-300 transition-colors"
        >
          <ExternalLink className="w-2.5 h-2.5" />
          {s.topHeadline.source} · {formatDistanceToNow(new Date(s.topHeadline.datetime * 1000), { addSuffix: true })}
        </a>
      )}
    </div>
  )
}
