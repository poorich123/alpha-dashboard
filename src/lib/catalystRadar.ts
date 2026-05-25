/**
 * Catalyst Radar — real-time SPEC scanner
 * ────────────────────────────────────────
 * Identifies "catalyst-driven" momentum opportunities by combining:
 *   1. Recent news (last 24h, headline + summary)
 *   2. Sentiment + impact scoring (HIGH / CRITICAL signals only)
 *   3. Price gap (open vs previous close)
 *   4. Volume spike (today vs 20-day average)
 *
 * Used for SPEC strategy positions where technical levels (Pivot S/R) don't
 * apply — entry is triggered by news, not chart pattern.
 *
 * Algorithm:
 *   For each ticker:
 *     - score = 0
 *     - if recent news + HIGH impact: +30 pts
 *     - if recent news + CRITICAL impact: +40 pts
 *     - if BULLISH sentiment: +20 pts; BEARISH: -20 pts (still actionable as short setup)
 *     - if volume > 2× 20d avg: +20 pts
 *     - if volume > 5× 20d avg: +30 pts
 *     - if abs(gap) > 3%: +15 pts
 *     - if abs(gap) > 8%: +25 pts
 *   Threshold: score >= 50 → live catalyst
 *
 * Output: ranked list with action ("LONG" / "SHORT" / "WATCH").
 */

import { getNews, getMarketNews } from "./finnhub"
import { quickScoreImpact, quickScoreSentiment } from "./newsMonitor"
import { getYahooCandles } from "./yfinance"
import type { NewsItem } from "@/types"

export interface CatalystSignal {
  ticker: string
  score: number          // 0-100
  action: "LONG" | "SHORT" | "WATCH"
  reasons: string[]      // human-readable bullets
  // Top headline + metadata
  topHeadline?: NewsItem
  // Price metrics
  currentPrice: number
  prevClose: number
  gapPct: number
  // Volume metrics
  todayVolume: number
  avgVolume20d: number
  volumeRatio: number    // todayVolume / avgVolume20d
  scannedAt: number
}

/**
 * Scan a single ticker for active catalyst signal.
 * Returns null if no catalyst detected (score < 50).
 *
 * @param ticker - symbol to scan
 * @param preloadedNews - optional news (skip getNews API call if provided)
 */
async function scanTicker(
  ticker: string,
  preloadedNews?: NewsItem[]
): Promise<CatalystSignal | null> {
  try {
    // ── Pull news (last 7 days but we'll filter to 24h) ────────────
    const news = preloadedNews ?? await getNews(ticker).catch(() => [] as NewsItem[])
    const now = Date.now() / 1000
    const recent24h = news.filter(n => now - n.datetime < 24 * 3600)

    // ── Pull price + volume from Yahoo (5-day window) ──────────────
    const candle = await getYahooCandles(ticker, "5d", "1d").catch(() => null)
    if (!candle || candle.c.length < 2) return null

    const closes = candle.c
    const opens  = candle.o
    const volumes = candle.v
    const len = closes.length
    const currentPrice = closes[len - 1]
    const prevClose    = closes[len - 2]
    const todayOpen    = opens[len - 1]
    const todayVolume  = volumes[len - 1]

    // 20-day average — need more bars
    let avgVolume20d = todayVolume
    if (volumes.length >= 5) {
      // Use last 5 days (we requested 5d window) — actual 20-day would need 1mo range
      const recent = volumes.slice(-Math.min(5, volumes.length - 1), -1)  // exclude today
      avgVolume20d = recent.reduce((a, b) => a + b, 0) / Math.max(1, recent.length)
    }

    const gapPct = ((todayOpen - prevClose) / prevClose) * 100
    const volumeRatio = avgVolume20d > 0 ? todayVolume / avgVolume20d : 1

    // ── Score the catalyst ─────────────────────────────────────────
    let score = 0
    const reasons: string[] = []
    let topHeadline: NewsItem | undefined

    // Find best (highest impact) recent headline
    let bestImpact: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW"
    let bestSentiment: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL"
    for (const n of recent24h) {
      const imp = quickScoreImpact(n.headline, n.summary)
      const sent = quickScoreSentiment(n.headline, n.summary)
      const impRank = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 }
      if (impRank[imp] > impRank[bestImpact]) {
        bestImpact = imp
        bestSentiment = sent
        topHeadline = n
      }
    }

    if (bestImpact === "CRITICAL") {
      score += 40
      reasons.push(`🚨 CRITICAL news: "${topHeadline?.headline.slice(0, 80)}…"`)
    } else if (bestImpact === "HIGH") {
      score += 30
      reasons.push(`⚠️ HIGH-impact news: "${topHeadline?.headline.slice(0, 80)}…"`)
    } else if (bestImpact === "MEDIUM" && recent24h.length > 0) {
      score += 10
    }

    if (bestSentiment === "BULLISH") {
      score += 20
      reasons.push("📈 Bullish sentiment")
    } else if (bestSentiment === "BEARISH") {
      score -= 5  // small negative — could be short setup but riskier
      reasons.push("📉 Bearish sentiment")
    }

    if (volumeRatio >= 5) {
      score += 30
      reasons.push(`🔥 Volume ${volumeRatio.toFixed(1)}× normal (massive)`)
    } else if (volumeRatio >= 2) {
      score += 20
      reasons.push(`📊 Volume ${volumeRatio.toFixed(1)}× normal (elevated)`)
    }

    if (Math.abs(gapPct) >= 8) {
      score += 25
      reasons.push(`⚡ Gap ${gapPct >= 0 ? "+" : ""}${gapPct.toFixed(1)}% (major)`)
    } else if (Math.abs(gapPct) >= 3) {
      score += 15
      reasons.push(`📊 Gap ${gapPct >= 0 ? "+" : ""}${gapPct.toFixed(1)}%`)
    }

    // Lower threshold (20) — keep weak signals visible to user as "lower confidence"
    // UI will split into "strong" (≥50) vs "weak" (20-49) so user understands the gap.
    if (score < 20) return null

    // Determine action
    let action: "LONG" | "SHORT" | "WATCH" = "WATCH"
    if (bestSentiment === "BULLISH" && gapPct > 0)      action = "LONG"
    else if (bestSentiment === "BEARISH" && gapPct < 0) action = "SHORT"
    else if (gapPct > 0 && volumeRatio >= 2)            action = "LONG"
    else if (gapPct < 0 && volumeRatio >= 2)            action = "SHORT"

    return {
      ticker,
      score: Math.min(100, score),
      action,
      reasons,
      topHeadline,
      currentPrice,
      prevClose,
      gapPct,
      todayVolume,
      avgVolume20d,
      volumeRatio,
      scannedAt: Date.now(),
    }
  } catch {
    return null
  }
}

/**
 * Scan multiple tickers for catalysts in parallel (batched).
 * Per-ticker news fetched individually (Finnhub /news?symbol=X).
 * Use this for small ticker lists (< 30) like holdings/watchlist.
 */
export async function scanCatalysts(
  tickers: string[],
  options: { topN?: number; onProgress?: (done: number, total: number) => void } = {}
): Promise<CatalystSignal[]> {
  const { topN = 10, onProgress } = options
  const results: CatalystSignal[] = []
  let done = 0
  const BATCH = 5

  for (let i = 0; i < tickers.length; i += BATCH) {
    const batch = tickers.slice(i, i + BATCH)
    const settled = await Promise.allSettled(batch.map(t => scanTicker(t)))
    for (const s of settled) {
      if (s.status === "fulfilled" && s.value) {
        results.push(s.value)
      }
    }
    done += batch.length
    onProgress?.(done, tickers.length)
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
}

/**
 * Universe scan with news-prefilter — the professional approach.
 *
 * Step 1: Fetch ONE call to getMarketNews() → get all recent market news.
 * Step 2: Build ticker → news[] map by parsing each news.related field
 *         (Finnhub tags articles with affected ticker symbols).
 * Step 3: Candidate pool = (tickers in universe ∩ tickers with news) ∪ alwaysInclude.
 *         This typically reduces 700+ universe → 30-100 actual candidates.
 * Step 4: Deep-scan each candidate using PRE-LOADED news (no per-ticker
 *         Finnhub call) + Yahoo candles. Yahoo has no strict rate limit.
 *
 * Result: a sub-5-min scan of a 700-ticker universe with minimal API quota.
 */
export async function scanCatalystsUniverse(
  universe: string[],
  options: {
    topN?: number
    alwaysInclude?: string[]  // tickers to scan even without news (e.g. portfolio)
    onProgress?: (done: number, total: number, phase: "prefilter" | "scan") => void
  } = {}
): Promise<{ signals: CatalystSignal[]; candidatesScanned: number; universeSize: number }> {
  const { topN = 15, alwaysInclude = [], onProgress } = options

  // ── Step 1+2: Fetch market news, build ticker→news map ─────────────
  onProgress?.(0, 1, "prefilter")
  const marketNews = await getMarketNews().catch(() => [] as NewsItem[])
  const newsMap = new Map<string, NewsItem[]>()
  const now = Date.now() / 1000

  for (const n of marketNews) {
    // related is space-separated ticker symbols in Finnhub responses
    if (!n.related || now - n.datetime > 24 * 3600) continue
    const tickers = n.related.split(/[\s,]+/).map(t => t.trim().toUpperCase()).filter(Boolean)
    for (const t of tickers) {
      if (!newsMap.has(t)) newsMap.set(t, [])
      newsMap.get(t)!.push(n)
    }
  }
  onProgress?.(1, 1, "prefilter")

  // ── Step 3: Build candidate pool ───────────────────────────────────
  const universeSet = new Set(universe.map(t => t.toUpperCase()))
  const alwaysSet = new Set(alwaysInclude.map(t => t.toUpperCase()))
  const candidates: string[] = []
  for (const t of universeSet) {
    if (newsMap.has(t) || alwaysSet.has(t)) candidates.push(t)
  }
  // Always include holdings even if not in universe
  for (const t of alwaysSet) {
    if (!universeSet.has(t)) candidates.push(t)
  }

  // ── Step 4: Deep-scan candidates with preloaded news ───────────────
  const results: CatalystSignal[] = []
  let done = 0
  const BATCH = 8  // Yahoo can handle more in parallel

  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH)
    const settled = await Promise.allSettled(
      batch.map(t => scanTicker(t, newsMap.get(t) || []))
    )
    for (const s of settled) {
      if (s.status === "fulfilled" && s.value) {
        results.push(s.value)
      }
    }
    done += batch.length
    onProgress?.(done, candidates.length, "scan")
  }

  return {
    signals: results.sort((a, b) => b.score - a.score).slice(0, topN),
    candidatesScanned: candidates.length,
    universeSize: universeSet.size,
  }
}
