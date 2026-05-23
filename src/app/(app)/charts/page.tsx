"use client"

import { useState, useEffect, useRef } from "react"
import { Search, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { usePortfolioStore } from "@/store/portfolioStore"
import { getQuote } from "@/lib/finnhub"
import { getYahooCandles, deriveQuoteFromCandle } from "@/lib/yfinance"
import { getTechnicalAnalysis } from "@/lib/technical"
import { analyzeStock } from "@/lib/claude"
import type { TechnicalAnalysis } from "@/types"
import toast from "react-hot-toast"
import { InlineSpinner } from "@/components/ui/LoadingSpinner"
import ReactMarkdown from "react-markdown"

declare global {
  interface Window {
    TradingView?: unknown
  }
}

function TradingViewWidget({ symbol, theme }: { symbol: string; theme: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!widgetRef.current) return
    widgetRef.current.innerHTML = ""

    const script = document.createElement("script")
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js"
    script.type = "text/javascript"
    script.async = true
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: symbol,
      interval: "D",
      timezone: "Etc/UTC",
      theme: theme === "dark" ? "dark" : "light",
      style: "1",
      locale: "en",
      backgroundColor: "#0C1628",
      gridColor: "rgba(31, 41, 55, 1)",
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: true,
      save_image: true,
      studies: [
        "STD;EMA@tv-basicstudies",
        "STD;RSI@tv-basicstudies",
        "STD;MACD@tv-basicstudies",
        "STD;Volume@tv-basicstudies",
      ],
      show_popup_button: true,
      popup_width: "1000",
      popup_height: "650",
    })

    widgetRef.current.appendChild(script)
    return () => {
      if (widgetRef.current) widgetRef.current.innerHTML = ""
    }
  }, [symbol, theme])

  return (
    <div ref={containerRef} className="tradingview-widget-container" style={{ height: "500px" }}>
      <div ref={widgetRef} className="tradingview-widget-container__widget" style={{ height: "100%", width: "100%" }} />
    </div>
  )
}

const SIGNAL_CONFIG = {
  "STRONG BUY": { color: "text-green-400", bg: "bg-green-500/20", border: "border-green-500/50" },
  "BUY": { color: "text-green-300", bg: "bg-green-500/10", border: "border-green-500/30" },
  "NEUTRAL": { color: "text-yellow-400", bg: "bg-yellow-500/20", border: "border-yellow-500/50" },
  "SELL": { color: "text-red-300", bg: "bg-red-500/10", border: "border-red-500/30" },
  "STRONG SELL": { color: "text-red-400", bg: "bg-red-500/20", border: "border-red-500/50" },
}

export default function ChartsPage() {
  const { positions } = usePortfolioStore()
  const [symbol, setSymbol] = useState("NASDAQ:NVDA")
  const [searchInput, setSearchInput] = useState("")
  const [technicals, setTechnicals] = useState<TechnicalAnalysis | null>(null)
  const [currentPrice, setCurrentPrice] = useState(0)
  const [loading, setLoading] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState("")
  const [aiLoading, setAiLoading] = useState(false)

  const tickers = [...new Set(positions.filter((p) => p.isActive).map((p) => p.ticker))]

  async function loadTechnicals(ticker: string) {
    setLoading(true)
    try {
      // Strip exchange prefix if present (e.g. "NASDAQ:NVDA" → "NVDA")
      const cleanTicker = ticker.includes(":") ? ticker.split(":")[1] : ticker

      // Yahoo Finance for candles (Finnhub free tier no longer supports /stock/candle)
      const candle = await getYahooCandles(cleanTicker, "1y", "1d")

      // Best-effort Finnhub quote, fall back to derived from Yahoo candle
      let price = 0
      try {
        const quote = await getQuote(cleanTicker)
        price = quote?.c || 0
      } catch { /* ignore */ }
      if (!price) {
        const derived = deriveQuoteFromCandle(candle)
        price = derived?.c || candle.c[candle.c.length - 1] || 0
      }

      if (candle.s === "ok" && candle.c.length > 0 && price > 0) {
        const ta = getTechnicalAnalysis(candle, price)
        setTechnicals(ta)
        setCurrentPrice(price)
      } else {
        toast.error("No candle data for " + cleanTicker)
      }
    } catch (err) {
      toast.error("Failed to load technicals: " + (err instanceof Error ? err.message : String(err)))
    } finally {
      setLoading(false)
    }
  }

  function handleSearch() {
    if (!searchInput.trim()) return
    const t = searchInput.trim().toUpperCase()
    setSymbol(t)
    loadTechnicals(t)
    setAiAnalysis("")
  }

  function handleSelectTicker(ticker: string) {
    setSymbol(ticker)
    setSearchInput(ticker)
    loadTechnicals(ticker)
    setAiAnalysis("")
  }

  async function handleAiAnalysis() {
    if (!technicals || !symbol) return
    setAiLoading(true)
    try {
      const ticker = symbol.includes(":") ? symbol.split(":")[1] : symbol
      const analysis = await analyzeStock(ticker, technicals, [])
      setAiAnalysis(analysis)
    } catch {
      setAiAnalysis("AI analysis unavailable. Check API key in Settings.")
    } finally {
      setAiLoading(false)
    }
  }

  useEffect(() => {
    if (positions.length > 0) {
      const first = positions.find((p) => p.isActive)
      if (first) {
        setSymbol(first.ticker)
        setSearchInput(first.ticker)
        loadTechnicals(first.ticker)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const signalCfg = technicals ? SIGNAL_CONFIG[technicals.signal] : null

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Charts</h1>
      </div>

      {/* Stock Selector */}
      <div className="flex gap-2 mb-4">
        <div className="flex gap-2 flex-1">
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
            placeholder="Search any ticker..."
            className="bg-[#0C1628] border-[#1A2E52] text-white font-mono"
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <Button
            onClick={handleSearch}
            className="bg-[#00C2D4] hover:bg-[#00A8BC] shrink-0"
          >
            <Search className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Quick Tickers */}
      {tickers.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {tickers.slice(0, 10).map((t) => (
            <button
              key={t}
              onClick={() => handleSelectTicker(t)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                symbol === t || symbol.endsWith(t)
                  ? "bg-[#00C2D4] text-white"
                  : "bg-[#0C1628] border border-[#1A2E52] text-gray-400 hover:text-white hover:border-[#00C2D4]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* TradingView Chart */}
        <div className="lg:col-span-2 bg-[#0C1628] border border-[#1A2E52] rounded-xl overflow-hidden">
          <TradingViewWidget symbol={symbol} theme="dark" />
        </div>

        {/* Technical Analysis Panel */}
        <div className="space-y-4">
          {/* Signal Summary */}
          {technicals ? (
            <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs text-gray-500 uppercase tracking-wide">Technical Summary</div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => loadTechnicals(symbol.includes(":") ? symbol.split(":")[1] : symbol)}
                  disabled={loading}
                  className="text-gray-400 hover:text-white p-1"
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                </Button>
              </div>

              {signalCfg && (
                <div className={`flex items-center justify-center py-2 rounded-lg border ${signalCfg.bg} ${signalCfg.border} mb-4`}>
                  <span className={`font-bold text-lg ${signalCfg.color}`}>{technicals.signal}</span>
                </div>
              )}

              {/* Moving Averages */}
              <div className="mb-3">
                <div className="text-xs text-gray-600 mb-2">MOVING AVERAGES</div>
                {[
                  { label: "EMA 20", value: technicals.ema20, above: currentPrice > technicals.ema20 },
                  { label: "EMA 50", value: technicals.ema50, above: technicals.aboveEma50 },
                  { label: "EMA 100", value: technicals.ema100, above: currentPrice > technicals.ema100 },
                  { label: "EMA 200", value: technicals.ema200, above: technicals.aboveEma200 },
                ].map((ma) => (
                  <div key={ma.label} className="flex items-center justify-between py-1 text-xs border-b border-[#1A2E52] last:border-0">
                    <span className="text-gray-400">{ma.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-300">${ma.value.toFixed(2)}</span>
                      <span className={ma.above ? "text-green-400" : "text-red-400"}>
                        {ma.above ? "✅" : "❌"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Oscillators */}
              <div className="mb-3">
                <div className="text-xs text-gray-600 mb-2">OSCILLATORS</div>
                <div className="flex items-center justify-between py-1 text-xs border-b border-[#1A2E52]">
                  <span className="text-gray-400">RSI (14)</span>
                  <span className={
                    technicals.rsi > 70 ? "text-red-400" :
                    technicals.rsi < 30 ? "text-green-400" :
                    "text-yellow-400"
                  }>
                    {technicals.rsi.toFixed(1)}
                    {technicals.rsi > 70 ? " Overbought" : technicals.rsi < 30 ? " Oversold" : " Neutral"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 text-xs border-b border-[#1A2E52]">
                  <span className="text-gray-400">MACD</span>
                  <span className={technicals.macd > technicals.macdSignal ? "text-green-400" : "text-red-400"}>
                    {technicals.macd.toFixed(3)}
                    {technicals.macd > technicals.macdSignal ? " Bullish" : " Bearish"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 text-xs">
                  <span className="text-gray-400">Trend</span>
                  <span className={
                    technicals.trend === "uptrend" ? "text-green-400" :
                    technicals.trend === "downtrend" ? "text-red-400" :
                    "text-yellow-400"
                  }>
                    {technicals.trend.charAt(0).toUpperCase() + technicals.trend.slice(1)}
                  </span>
                </div>
              </div>

              {/* Support & Resistance */}
              <div>
                <div className="text-xs text-gray-600 mb-2">SUPPORT & RESISTANCE</div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-red-400">R2</span>
                    <span className="text-gray-300">${technicals.resistance2.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-red-300">R1</span>
                    <span className="text-gray-300">${technicals.resistance1.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between bg-[#1A2E52] rounded px-2 py-1">
                    <span className="text-white font-medium">Current</span>
                    <span className="text-white font-medium">${currentPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-300">S1</span>
                    <span className="text-gray-300">${technicals.support1.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-400">S2</span>
                    <span className="text-gray-300">${technicals.support2.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <InlineSpinner className="text-[#00D8EE]" />
                  <span className="ml-2 text-gray-400 text-sm">Loading technicals...</span>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 text-sm">
                  Search a ticker to see technical analysis
                </div>
              )}
            </div>
          )}

          {/* AI Analysis */}
          <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs text-gray-500 uppercase tracking-wide">AI Analysis</div>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleAiAnalysis}
                disabled={!technicals || aiLoading}
                className="text-xs text-[#00D8EE] hover:text-[#80ECF8]"
              >
                {aiLoading ? <><InlineSpinner className="mr-1" />Analyzing...</> : "Analyze"}
              </Button>
            </div>
            {aiAnalysis ? (
              <div className="prose prose-sm prose-invert max-w-none text-gray-300 text-xs">
                <ReactMarkdown>{aiAnalysis}</ReactMarkdown>
              </div>
            ) : (
              <div className="text-center py-4 text-gray-600 text-xs">
                Click Analyze for AI technical breakdown
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
