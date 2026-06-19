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
import {
  SP500, ETF_LIST, NYSE_INTERESTING, SPECULATIVE_MOMENTUM,
} from "./stockLists"

// ─── Stock universe — 4 categories ───────────────────────────────────────────

export const STOCK_UNIVERSE = {
  sp500:       SP500,                 // ~500 S&P 500 large caps
  etf:         ETF_LIST,              // ~35 ETFs
  nyse:        NYSE_INTERESTING,      // ~40 NYSE non-S&P (intl ADRs + others)
  speculative: SPECULATIVE_MOMENTUM,  // ~60 NASDAQ momentum small-mid cap
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
  marketCap: string         // formatted: "5.32T" / "850B" / "2.5B"
  marketCapNum: number      // raw value in USD (for sorting)

  // Trade levels
  tp1: number
  accumLow: number
  accumHigh: number
  sl: number
  riskReward: number

  // Swing setup (real pivot S/R based)
  setupGrade: AnalyzerResult["swingSetup"]["grade"]
  swingAction: AnalyzerResult["swingSetup"]["action"]
  distToSupportPct: number  // how far price sits above real support (0 = at support)
  riskPct: number           // distance to stop = margin of safety
  rr: number                // reward to real resistance ÷ risk to stop

  // Technical state (for filters)
  rsi: number              // 0-100
  support1: number         // nearest REAL pivot support below current price
  resistance1: number      // nearest REAL pivot resistance above current price
  aboveEma50: boolean
  aboveEma200: boolean
  week52High: number       // 52-week high (for "broke resistance" detection)
  week52Low: number        // 52-week low

  // Trend for sparkline (last 30 closes)
  trend30d: number[]

  // Momentum bars (1D/1W/1M/3M/6M/1Y scores 0-100)
  gauges: { timeframe: string; score: number }[]

  scannedAt: number
}

// Parse marketCap string ("5.32T" / "850B" / "2.5M") → raw number
function parseMarketCap(s: string): number {
  if (!s || s === "N/A") return 0
  const m = s.match(/^([\d.]+)([TBMK])?/i)
  if (!m) return 0
  const num = parseFloat(m[1])
  const unit = (m[2] || "").toUpperCase()
  const mult = unit === "T" ? 1e12 : unit === "B" ? 1e9 : unit === "M" ? 1e6 : unit === "K" ? 1e3 : 1
  return num * mult
}

function fromAnalyzer(r: AnalyzerResult): MarketScanResult {
  // Extract RSI value from thesis check
  const rsiCheck = r.thesis.find(t => t.id === "rsi")
  const rsi = rsiCheck ? parseFloat(rsiCheck.value) || 50 : 50

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
    marketCap: r.snapshot.marketCap || "N/A",
    marketCapNum: parseMarketCap(r.snapshot.marketCap || ""),
    tp1: r.tradeLevels.tp1,
    accumLow: r.tradeLevels.tradeAccumLow,
    accumHigh: r.tradeLevels.tradeAccumHigh,
    sl: r.tradeLevels.sl,
    riskReward: r.tradeLevels.riskReward,
    setupGrade: r.swingSetup.grade,
    swingAction: r.swingSetup.action,
    distToSupportPct: r.swingSetup.distToSupportPct,
    riskPct: r.swingSetup.riskPct,
    rr: r.swingSetup.rr,
    rsi,
    support1:     r.srLevels.support1,     // REAL pivot support
    resistance1:  r.srLevels.resistance1,  // REAL pivot resistance
    aboveEma50:   r.snapshot.currentPrice > r.snapshot.sma50,
    aboveEma200:  r.snapshot.currentPrice > r.snapshot.sma200,
    week52High:   r.snapshot.week52High,
    week52Low:    r.snapshot.week52Low,
    trend30d: r.candles.c.slice(-30),
    gauges: r.trendGauges.map(g => ({ timeframe: g.timeframe, score: g.score })),
    scannedAt: Date.now(),
  }
}

// ─── Sort by signal rank (STRONG BUY → STRONG SELL) ────────────────────────

const SIGNAL_RANK: Record<AnalyzerResult["signal"], number> = {
  "STRONG BUY":  5,
  "BUY":         4,
  "HOLD":        3,
  "SELL":        2,
  "STRONG SELL": 1,
}

const CONFIDENCE_RANK: Record<AnalyzerResult["confidence"], number> = {
  HIGH: 3, MEDIUM: 2, LOW: 1,
}

export function sortByConviction(results: MarketScanResult[]): MarketScanResult[] {
  return [...results].sort((a, b) => {
    // 1. Signal rank (BUY > SELL)
    const sigDiff = SIGNAL_RANK[b.signal] - SIGNAL_RANK[a.signal]
    if (sigDiff !== 0) return sigDiff
    // 2. Score % within same signal
    const scoreDiff = b.scorePct - a.scorePct
    if (Math.abs(scoreDiff) > 3) return scoreDiff
    // 3. Confidence (HIGH first)
    const confDiff = CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence]
    if (confDiff !== 0) return confDiff
    // 4. Market cap (larger first — more liquid)
    return b.marketCapNum - a.marketCapNum
  })
}

// ─── Swing-ready ranking (default) — safest entry at real support first ──────
//
// Surface stocks sitting AT a real support in an uptrend with strong R/R (the
// low-risk entries) ahead of extended momentum names that should be waited out.

const SWING_GRADE_RANK: Record<MarketScanResult["setupGrade"], number> = {
  A: 5, B: 4, C: 3, WAIT: 2, AVOID: 1,
}

export function sortBySwingSetup(results: MarketScanResult[]): MarketScanResult[] {
  return [...results].sort((a, b) => {
    // 1. Setup grade (A prime → AVOID)
    const gradeDiff = SWING_GRADE_RANK[b.setupGrade] - SWING_GRADE_RANK[a.setupGrade]
    if (gradeDiff !== 0) return gradeDiff
    // 2. Better R/R first
    if (Math.abs(b.rr - a.rr) > 0.2) return b.rr - a.rr
    // 3. Closer to real support first (smaller dist = better entry)
    if (Math.abs(a.distToSupportPct - b.distToSupportPct) > 0.5) return a.distToSupportPct - b.distToSupportPct
    // 4. Stronger signal, then liquidity
    const sigDiff = SIGNAL_RANK[b.signal] - SIGNAL_RANK[a.signal]
    if (sigDiff !== 0) return sigDiff
    return b.marketCapNum - a.marketCapNum
  })
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

  // Dedupe + optional limit (default: scan everything)
  const all = Array.from(new Set(STOCK_UNIVERSE[category]))
  const tickers = options?.limit ? all.slice(0, options.limit) : all
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

  // Default: swing-ready ranking (safest entry at real support first)
  const sorted = sortBySwingSetup(results)

  cache.set(getCacheKey(category), { results: sorted, timestamp: Date.now() })
  return sorted
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
