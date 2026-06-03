"use client"

import { useState, useEffect, useCallback, useMemo, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Search, ScanLine, Sparkles, AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { analyzeStock, type AnalyzerResult } from "@/lib/stockAnalyzer"
import { fetchFundamentals, computeFairValue, type FairValueResult, type FundamentalsRaw } from "@/lib/fairValue"
import { computeBubbleScore } from "@/lib/bubbleScore"
import { AnalyzerHeader } from "@/components/analyzer/AnalyzerHeader"
import { EntryStrategyCard } from "@/components/analyzer/EntryStrategyCard"
import { FairValueCard } from "@/components/analyzer/FairValueCard"
import { BubbleScoreCard } from "@/components/analyzer/BubbleScoreCard"
import { AnalyzerChart } from "@/components/analyzer/AnalyzerChart"
import { TrendGaugeGrid } from "@/components/analyzer/TrendGauge"
import { TechnicalThesis } from "@/components/analyzer/TechnicalThesis"
import { MarketSnapshot, CompanyOverview } from "@/components/analyzer/MarketSnapshot"
import { HSRHeroBanner } from "@/components/hsr/HSRHeroBanner"
import { PAGE_CHARACTERS } from "@/components/hsr/characters"
import { usePortfolioStore } from "@/store/portfolioStore"
import { inferStrategy } from "@/types"
import toast from "react-hot-toast"
import { InlineSpinner } from "@/components/ui/LoadingSpinner"
import { format } from "date-fns"

const POPULAR_TICKERS = ["NVDA", "TSLA", "AAPL", "MSFT", "GOOGL", "META", "AMD", "PLTR"]

// Wrap in Suspense for useSearchParams (required by Next.js 16 prerender)
export default function AnalyzerPage() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-500">Loading…</div>}>
      <AnalyzerPageInner />
    </Suspense>
  )
}

function AnalyzerPageInner() {
  const [ticker, setTicker] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnalyzerResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fairValue, setFairValue] = useState<FairValueResult | null>(null)
  const [fundamentals, setFundamentals] = useState<FundamentalsRaw | null>(null)
  const [fvLoading, setFvLoading] = useState(false)
  const [fvError, setFvError] = useState<string | null>(null)
  const { positions } = usePortfolioStore()

  // Bubble score derives from technical result + (optional) valuation/fundamentals
  const bubbleScore = useMemo(
    () => (result ? computeBubbleScore(result, fairValue, fundamentals) : null),
    [result, fairValue, fundamentals],
  )
  const searchParams = useSearchParams()

  const myTickers = Array.from(new Set(
    positions.filter(p => p.isActive).map(p => p.ticker.toUpperCase())
  ))

  const analyze = useCallback(async (tkr: string) => {
    if (!tkr.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    setFairValue(null)
    setFundamentals(null)
    setFvError(null)
    setFvLoading(true)

    // Fair value runs independently of the technical pipeline — fundamentals may
    // be missing (ETF/ADR) without that being a reason to fail the whole analysis.
    fetchFundamentals(tkr)
      .then(f => { setFundamentals(f); setFairValue(computeFairValue(f)) })
      .catch(e => setFvError(e instanceof Error ? e.message : String(e)))
      .finally(() => setFvLoading(false))

    try {
      const r = await analyzeStock(tkr)
      if (!r) {
        setError(`Could not fetch data for ${tkr.toUpperCase()}. Check ticker symbol and Finnhub API key.`)
        toast.error("Analysis failed")
      } else {
        setResult(r)
        toast.success(`${r.ticker} — ${r.signal}`)
      }
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : String(err)}`)
      toast.error("Analysis failed")
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    analyze(ticker)
  }

  // Auto-analyze if ?ticker=XXX is passed in URL (e.g. from alert link)
  useEffect(() => {
    const qTicker = searchParams.get("ticker")
    if (qTicker && qTicker !== ticker) {
      setTicker(qTicker.toUpperCase())
      analyze(qTicker)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const character = PAGE_CHARACTERS.analyzer

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      {/* ── HSR Hero Banner with Jingliu ──────────────────────────── */}
      <HSRHeroBanner character={character} title="Stock Analyzer" height="h-44">
        <div className="text-[10px] tracking-[0.2em] uppercase font-semibold mb-1" style={{ color: character.color }}>
          {character.role}
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">Stock Analyzer</h1>
        <div className="text-xs text-gray-400 mb-3">
          TP24-style scoring · multi-timeframe trend · auto TP/SL levels
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-500 pointer-events-none" />
            <Input
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="Enter ticker (e.g. NVDA, AAPL)"
              className="pl-8 bg-black/40 border-[#1A2E52] text-white text-sm h-9"
              autoFocus
            />
          </div>
          <Button type="submit" disabled={loading || !ticker.trim()} className="bg-[#00C2D4] hover:bg-[#00A8BC] gap-1 h-9">
            {loading ? <InlineSpinner className="w-3.5 h-3.5" /> : <ScanLine className="w-3.5 h-3.5" />}
            {loading ? "Analyzing…" : "Analyze"}
          </Button>
        </form>
      </HSRHeroBanner>

      {/* ── Quick suggestions ─────────────────────────────────────── */}
      {!result && !loading && (
        <div className="space-y-3 mb-4">
          {myTickers.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
                <Sparkles className="w-3 h-3" />Your positions
              </span>
              {myTickers.slice(0, 10).map(t => (
                <button
                  key={t}
                  onClick={() => { setTicker(t); analyze(t) }}
                  className="text-xs bg-[#0C1628] border border-[#1A3A5C] text-cyan-300 hover:bg-[#00C2D4]/10 hover:border-[#00C2D4] px-2.5 py-1 rounded font-mono transition-colors"
                >{t}</button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 uppercase tracking-wide">Popular</span>
            {POPULAR_TICKERS.map(t => (
              <button
                key={t}
                onClick={() => { setTicker(t); analyze(t) }}
                className="text-xs bg-[#0C1628] border border-[#1A2E52] text-gray-400 hover:text-white hover:border-[#00C2D4]/30 px-2.5 py-1 rounded font-mono transition-colors"
              >{t}</button>
            ))}
          </div>
        </div>
      )}

      {/* ── Loading skeleton ──────────────────────────────────────── */}
      {loading && (
        <div className="space-y-4">
          <div className="h-40 bg-[#0C1628] border border-[#1A2E52] rounded-2xl animate-pulse" />
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            {Array(6).fill(0).map((_, i) => (
              <div key={i} className="h-32 bg-[#0C1628] border border-[#1A2E52] rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="h-72 bg-[#0C1628] border border-[#1A2E52] rounded-2xl animate-pulse" />
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────── */}
      {error && !loading && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-sm font-semibold text-red-400 mb-1">Analysis failed</div>
            <div className="text-xs text-gray-400">{error}</div>
          </div>
        </div>
      )}

      {/* ── Result ────────────────────────────────────────────────── */}
      {result && !loading && (
        <div className="space-y-4">
          {/* Top header with score + TP/SL */}
          <AnalyzerHeader result={result} />

          {/* ── Entry Strategy Card — real-time recommendation ── */}
          <EntryStrategyCard
            rec={result.entryRec}
            levels={result.tradeLevels}
            ticker={result.ticker}
            srLevels={result.srLevels}
            fibLevels={result.fibLevels}
            positionStrategy={(() => {
              // If user holds this ticker, use its strategy; else undefined
              const positions = usePortfolioStore.getState().positions
              const held = positions.find(p =>
                p.ticker.toUpperCase() === result.ticker.toUpperCase() &&
                p.isActive && p.category !== "watchlist"
              )
              return held ? (held.strategy ?? inferStrategy(held.category)) : undefined
            })()}
          />

          {/* ── Fair Value / Margin of Safety (fundamentals, independent fetch) ── */}
          <FairValueCard result={fairValue} loading={fvLoading} error={fvError} />

          {/* ── Bubble Score (Dalio 6-point, derived from technical + valuation) ── */}
          <BubbleScoreCard result={bubbleScore} />

          {/* Two-column: Chart + Trend Gauges */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
            <AnalyzerChart result={result} />

            {/* Trend strength grid */}
            <div className="bg-[#0C1628] border border-[#1A2E52] rounded-2xl p-4 hsr-card">
              <div className="mb-3">
                <div className="text-xs text-gray-500 uppercase tracking-widest">Trend Strength</div>
                <div className="text-sm text-white font-semibold">ภาพรวมแนวโน้มตามแต่ละช่วงเวลา</div>
                <div className="text-[10px] text-gray-600">เลือกช่วงเวลาแล้วกราฟจะ sync ตามทันที</div>
              </div>
              <TrendGaugeGrid gauges={result.trendGauges} />

              {/* Refresh */}
              <div className="mt-3 pt-3 border-t border-[#1A2E52] flex items-center justify-between">
                <span className="text-[10px] text-gray-600">
                  Updated {format(new Date(result.scannedAt), "HH:mm:ss")}
                </span>
                <button
                  onClick={() => analyze(result.ticker)}
                  className="text-[10px] text-cyan-400 hover:text-cyan-200 flex items-center gap-1"
                >
                  <RefreshCw className="w-2.5 h-2.5" /> Rescan
                </button>
              </div>
            </div>
          </div>

          {/* Three-column: Thesis + Snapshot + Company */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr_1fr] gap-4">
            <TechnicalThesis checks={result.thesis} />
            <MarketSnapshot snapshot={result.snapshot} />
            <CompanyOverview snapshot={result.snapshot} />
          </div>

          {/* Bottom CTA */}
          <div className="bg-gradient-to-r from-[#0C1628] to-[#0a1a2e] border border-[#1A2E52] rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Auto Update</div>
              <div className="text-sm text-white">การวิเคราะห์อัปเดตอัตโนมัติทุกครั้งที่เปิดหน้า · last scan {format(new Date(result.scannedAt), "d MMM HH:mm")}</div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setResult(null); setTicker(""); setFairValue(null); setFundamentals(null); setFvError(null) }}
                className="border-[#1F3566] text-gray-300"
              >
                Search Another
              </Button>
              <Button
                size="sm"
                onClick={() => analyze(result.ticker)}
                className="bg-[#00C2D4] hover:bg-[#00A8BC]"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Rescan
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
