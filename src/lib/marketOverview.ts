/**
 * Market Overview — TP24-style stock screener
 * ───────────────────────────────────────────
 * Scans a curated universe of stocks, ranks by score, returns top picks
 * with all fields needed for the TP24-style table:
 *   - Trend sparkline (last 30d)
 *   - Signal (BUY/HOLD/SELL)
 *   - Confidence (HIGH/MEDIUM/LOW)
 *   - Score (X/Y)
 *   - Current price + % change
 *   - TP (take profit target)
 *   - Accumulation Zone
 *   - Momentum bars per timeframe (1D/1W/1M/3M/6M/1Y)
 */

import { analyzeStock, type AnalyzerResult } from "./stockAnalyzer"

// ─── Curated stock universe ──────────────────────────────────────────────────

export const STOCK_UNIVERSE = {
  // High-conviction mega-caps
  premium: [
    "NVDA", "MSFT", "AAPL", "GOOGL", "META", "AMZN", "TSLA",
    "AVGO", "NFLX", "TSM", "PLTR", "COST", "LLY", "V", "MA",
  ],
  // Broader S&P 500 + Nasdaq 100 leaders
  us: [
    "NVDA", "MSFT", "AAPL", "GOOGL", "META", "AMZN", "TSLA", "AMD",
    "AVGO", "NFLX", "TSM", "PLTR", "COST", "LLY", "V", "MA",
    "MU", "ASML", "ADBE", "CRM", "ORCL", "CSCO", "QCOM", "TXN",
    "JPM", "BAC", "WFC", "GS", "JNJ", "PFE", "MRK", "ABBV", "UNH",
    "KO", "PEP", "WMT", "HD", "MCD", "NKE", "DIS",
  ],
  // ETFs (sector + thematic)
  etf: [
    "SPY", "QQQ", "VOO", "IVV", "VTI", "ARKK",
    "XLK", "XLE", "XLF", "XLV", "XLI", "XLY",
    "GLD", "SLV", "TLT", "USO", "EEM", "VEA",
  ],
}

export type CategoryKey = keyof typeof STOCK_UNIVERSE

// ─── Result type (lightweight, just what the table needs) ────────────────────

export interface MarketScanResult {
  ticker: string
  companyName: string
  logo: string
  sector: string

  // Signal & confidence
  signal: AnalyzerResult["signal"]
  confidence: AnalyzerResult["confidence"]
  score: number
  scoreMax: number
  scorePct: number

  // Price
  currentPrice: number
  changePct: number

  // Trade levels
  tp1: number
  accumLow: number
  accumHigh: number
  sl: number
  riskReward: number

  // Trend for sparkline (last 30 closes)
  trend30d: number[]

  // Momentum bars (1D/1W/1M/3M/6M/1Y scores 0-100)
  gauges: { timeframe: string; score: number }[]

  scannedAt: number
}

function fromAnalyzer(r: AnalyzerResult): MarketScanResult {
  return {
    ticker: r.ticker,
    companyName: r.companyName,
    logo: r.logo,
    sector: r.sector,
    signal: r.signal,
    confidence: r.confidence,
    score: r.score,
    scoreMax: r.scoreMax,
    scorePct: r.scorePct,
    currentPrice: r.snapshot.currentPrice,
    changePct: r.snapshot.changePct,
    tp1: r.tradeLevels.tp1,
    accumLow: r.tradeLevels.tradeAccumLow,
    accumHigh: r.tradeLevels.tradeAccumHigh,
    sl: r.tradeLevels.sl,
    riskReward: r.tradeLevels.riskReward,
    trend30d: r.candles.c.slice(-30),
    gauges: r.trendGauges.map(g => ({ timeframe: g.timeframe, score: g.score })),
    scannedAt: Date.now(),
  }
}

// ─── In-memory cache ─────────────────────────────────────────────────────────

const cache = new Map<string, { results: MarketScanResult[]; timestamp: number }>()
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes

function getCacheKey(category: CategoryKey): string {
  return `market:${category}`
}

export function getCachedScan(category: CategoryKey): MarketScanResult[] | null {
  const hit = cache.get(getCacheKey(category))
  if (!hit) return null
  if (Date.now() - hit.timestamp > CACHE_TTL) {
    cache.delete(getCacheKey(category))
    return null
  }
  return hit.results
}

// ─── Main scan function ─────────────────────────────────────────────────────

export async function scanMarket(
  category: CategoryKey,
  options?: {
    limit?: number
    onProgress?: (done: number, total: number, latest?: MarketScanResult) => void
    skipCache?: boolean
  },
): Promise<MarketScanResult[]> {
  // Return cache if fresh
  if (!options?.skipCache) {
    const cached = getCachedScan(category)
    if (cached) return cached
  }

  const tickers = STOCK_UNIVERSE[category].slice(0, options?.limit || 30)
  const total = tickers.length
  const results: MarketScanResult[] = []

  // Parallel batches of 5 — balance speed vs API rate limits
  const BATCH = 5
  let done = 0

  for (let i = 0; i < total; i += BATCH) {
    const batch = tickers.slice(i, i + BATCH)
    const batchResults = await Promise.allSettled(
      batch.map(t => analyzeStock(t)),
    )

    for (const res of batchResults) {
      done++
      if (res.status === "fulfilled" && res.value) {
        const r = fromAnalyzer(res.value)
        results.push(r)
        options?.onProgress?.(done, total, r)
      } else {
        options?.onProgress?.(done, total)
      }
    }
  }

  // Sort by score (descending — best first)
  // Tiebreaker: confidence HIGH > MEDIUM > LOW
  const confidenceRank = { HIGH: 3, MEDIUM: 2, LOW: 1 }
  results.sort((a, b) => {
    const scoreDiff = b.scorePct - a.scorePct
    if (Math.abs(scoreDiff) > 2) return scoreDiff
    return confidenceRank[b.confidence] - confidenceRank[a.confidence]
  })

  cache.set(getCacheKey(category), { results, timestamp: Date.now() })
  return results
}

// ─── Market Indices Quick Quote ──────────────────────────────────────────────

import { getYahooCandles } from "./yfinance"

export interface IndexQuote {
  symbol: string
  label: string
  description: string
  price: number
  changePct: number
  sparkline: number[]
}

export async function fetchMarketIndices(): Promise<IndexQuote[]> {
  const indices = [
    { symbol: "SPY",   label: "S&P 500",  description: "US Large-Cap Index" },
    { symbol: "QQQ",   label: "NDX100",   description: "Nasdaq-100 Index" },
    { symbol: "^VIX",  label: "VIX",      description: "Fear Index" },
    { symbol: "GC=F",  label: "Gold",     description: "XAU/USD Futures" },
    { symbol: "CL=F",  label: "WTI Crude Oil", description: "Crude Oil Futures" },
    { symbol: "DX-Y.NYB", label: "DXY",   description: "US Dollar Index" },
  ]

  const results = await Promise.allSettled(
    indices.map(async (idx) => {
      const candle = await getYahooCandles(idx.symbol, "1mo", "1d")
      const closes = candle.c
      const price = closes[closes.length - 1]
      const prev  = closes[closes.length - 2] || price
      const changePct = prev > 0 ? ((price - prev) / prev) * 100 : 0
      return {
        symbol: idx.symbol,
        label: idx.label,
        description: idx.description,
        price,
        changePct,
        sparkline: closes.slice(-30),
      } as IndexQuote
    }),
  )

  return results
    .filter((r): r is PromiseFulfilledResult<IndexQuote> => r.status === "fulfilled")
    .map(r => r.value)
}
