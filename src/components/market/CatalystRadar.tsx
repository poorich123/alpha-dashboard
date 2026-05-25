"use client"

import { useState, useCallback } from "react"
import { Radar, RefreshCw, ExternalLink, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { scanCatalysts, type CatalystSignal } from "@/lib/catalystRadar"
import { SPECULATIVE_MOMENTUM } from "@/lib/stockLists"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import toast from "react-hot-toast"

interface Props {
  /** Optional restricted ticker pool — defaults to SPECULATIVE_MOMENTUM */
  tickers?: string[]
}

export function CatalystRadar({ tickers }: Props) {
  const [scanning, setScanning] = useState(false)
  const [signals, setSignals] = useState<CatalystSignal[]>([])
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [open, setOpen] = useState(true)
  const [lastScannedAt, setLastScannedAt] = useState<number | null>(null)

  const pool = tickers ?? SPECULATIVE_MOMENTUM

  const runScan = useCallback(async () => {
    setScanning(true)
    setProgress({ done: 0, total: pool.length })
    try {
      // Limit to first 50 to avoid 5-min scan times (catalyst radar is volume-aware so
      // most relevant tickers are speculative anyway)
      const subset = pool.slice(0, 50)
      const results = await scanCatalysts(subset, {
        topN: 8,
        onProgress: (done, total) => setProgress({ done, total }),
      })
      setSignals(results)
      setLastScannedAt(Date.now())
      if (results.length === 0) {
        toast("No active catalysts found", { icon: "🌙" })
      } else {
        toast.success(`Found ${results.length} catalysts`)
      }
    } catch (err) {
      toast.error("Catalyst scan failed")
      console.error(err)
    } finally {
      setScanning(false)
    }
  }, [pool])

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
              SPEC scanner · news + volume + gap detection
              {lastScannedAt && (
                <span className="ml-1 text-gray-600">
                  · scanned {formatDistanceToNow(lastScannedAt, { addSuffix: true })}
                </span>
              )}
            </div>
          </div>
          {open ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />}
        </button>

        <Button
          size="sm"
          onClick={runScan}
          disabled={scanning}
          className="bg-fuchsia-500/20 hover:bg-fuchsia-500/30 border border-fuchsia-500/40 text-fuchsia-200 gap-1 h-8 text-xs"
        >
          {scanning ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Radar className="w-3 h-3" />}
          {scanning ? `Scanning ${progress.done}/${progress.total}…` : "Scan Now"}
        </Button>
      </div>

      {open && (
        <>
          {/* Progress bar */}
          {scanning && (
            <div className="px-4 py-2">
              <div className="h-1 bg-[#1A2E52] rounded-full overflow-hidden">
                <div
                  className="h-full bg-fuchsia-400 transition-all duration-300"
                  style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Empty state */}
          {!scanning && signals.length === 0 && (
            <div className="px-4 py-6 text-center">
              <div className="text-xs text-gray-500 mb-2">
                Click <strong className="text-fuchsia-300">Scan Now</strong> to detect live catalysts in {pool.slice(0, 50).length} SPEC tickers
              </div>
              <div className="text-[10px] text-gray-600 max-w-md mx-auto leading-relaxed">
                Catalyst Radar finds tickers with: news in last 24h (HIGH/CRITICAL impact) +
                volume {">"}2× normal + price gap {">"}3%. These signal news-driven SPEC opportunities
                where Pivot S/R don&apos;t apply.
              </div>
            </div>
          )}

          {/* Signal cards */}
          {signals.length > 0 && (
            <div className="divide-y divide-fuchsia-500/10">
              {signals.map(s => (
                <CatalystCard key={s.ticker} signal={s} />
              ))}
            </div>
          )}
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
