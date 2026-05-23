/**
 * Swing Trade Technical Scanner
 * ─────────────────────────────
 * Proactive chart-based analysis (independent of news).
 *
 * Watchlist: scores 1-5 each item (Buy → Wait → Avoid)
 *            based on RSI / EMA alignment / MACD / Volume
 *
 * Speculative: monitors for structure breakdown & bearish divergence,
 *              fires CRITICAL/HIGH/MEDIUM alerts
 */

import { getQuote } from "./finnhub"
import { getYahooCandles, deriveQuoteFromCandle } from "./yfinance"
import { getTechnicalAnalysis } from "./technical"
import type { Candle } from "@/types"
import type { WatchlistItem, Position, TechnicalAnalysis } from "@/types"
import type { NewsAlert } from "@/store/alertStore"

// ─── Score types ──────────────────────────────────────────────────────────────

export type SwingScore = 1 | 2 | 3 | 4 | 5

export interface SwingSignal {
  label: "RSI" | "EMA" | "MACD" | "Volume" | "Trend" | "BB"
  status: "bullish" | "bearish" | "neutral"
  value: string
}

export interface TechnicalScanResult {
  ticker: string
  score: SwingScore           // 1–5
  recommendation: "STRONG BUY" | "BUY" | "WAIT" | "CAUTION" | "AVOID"
  trend: "uptrend" | "downtrend" | "sideways"
  rsi: number
  ema20: number
  ema50: number
  ema200: number
  macdHistogram: number
  volumeRatio: number         // recent 5d avg / 20d avg
  signals: SwingSignal[]
  summary: string             // one-line human readable
  scannedAt: number           // timestamp
  aboveEma20: boolean
  aboveEma50: boolean
  aboveEma200: boolean
  support: number
  resistance: number
}

// ─── Score calculation ────────────────────────────────────────────────────────
//
// Based on Minervini SEPA + O'Neil CAN SLIM criteria for swing entries:
//  • Price in uptrend (above EMA50 + EMA200)
//  • RSI 45-65 (momentum zone, not overbought)
//  • MACD: positive histogram (momentum building)
//  • Price near EMA20 (pullback buy in uptrend)
//  • Volume: above average on up days

function calcVolumeRatio(volumes: number[]): number {
  if (volumes.length < 10) return 1
  const recent5  = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5
  const avg20    = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20
  return avg20 > 0 ? recent5 / avg20 : 1
}

function isHigherHighsLows(closes: number[], lookback = 20): boolean {
  const recent = closes.slice(-lookback)
  if (recent.length < 6) return false
  const mid = Math.floor(recent.length / 2)
  const firstHalf = recent.slice(0, mid)
  const secondHalf = recent.slice(mid)
  const firstHigh = Math.max(...firstHalf)
  const secondHigh = Math.max(...secondHalf)
  const firstLow = Math.min(...firstHalf)
  const secondLow = Math.min(...secondHalf)
  return secondHigh > firstHigh && secondLow > firstLow
}

export function scoreFromTA(
  ta: TechnicalAnalysis,
  currentPrice: number,
  volumes: number[],
  closes: number[]
): { score: SwingScore; recommendation: TechnicalScanResult["recommendation"]; signals: SwingSignal[]; summary: string } {
  let points = 0
  const signals: SwingSignal[] = []
  const volRatio = calcVolumeRatio(volumes)

  // ── Trend (0-3 pts) ───────────────────────────────────────────────────────
  if (currentPrice > ta.ema200) {
    points += 1
    signals.push({ label: "EMA", status: "bullish", value: `Above EMA200 (${ta.ema200.toFixed(2)})` })
  } else {
    signals.push({ label: "EMA", status: "bearish", value: `Below EMA200 (${ta.ema200.toFixed(2)})` })
  }
  if (currentPrice > ta.ema50) {
    points += 1
  }
  if (ta.ema20 > ta.ema50 && ta.ema50 > ta.ema200) {
    points += 1  // full EMA stack alignment
  }

  // Higher highs & higher lows structure
  const hhl = isHigherHighsLows(closes)
  if (hhl) {
    points += 1
    signals.push({ label: "Trend", status: "bullish", value: "Higher Highs & Lows" })
  } else {
    signals.push({ label: "Trend", status: ta.trend === "downtrend" ? "bearish" : "neutral", value: ta.trend })
  }

  // ── RSI (0-2 pts) ─────────────────────────────────────────────────────────
  const rsi = ta.rsi
  if (rsi >= 50 && rsi <= 65) {
    points += 2   // ideal momentum zone
    signals.push({ label: "RSI", status: "bullish", value: `RSI ${rsi.toFixed(1)} (ideal swing zone)` })
  } else if (rsi > 40 && rsi < 70) {
    points += 1
    signals.push({ label: "RSI", status: "neutral", value: `RSI ${rsi.toFixed(1)}` })
  } else if (rsi >= 70) {
    points -= 1   // overbought
    signals.push({ label: "RSI", status: "bearish", value: `RSI ${rsi.toFixed(1)} (overbought)` })
  } else {
    points -= 1   // oversold / weak
    signals.push({ label: "RSI", status: "bearish", value: `RSI ${rsi.toFixed(1)} (oversold/weak)` })
  }

  // ── MACD (0-2 pts) ────────────────────────────────────────────────────────
  if (ta.macd > ta.macdSignal && ta.macdHistogram > 0) {
    points += 2
    signals.push({ label: "MACD", status: "bullish", value: `Histogram +${ta.macdHistogram.toFixed(3)} (bullish crossover)` })
  } else if (ta.macd > 0) {
    points += 1
    signals.push({ label: "MACD", status: "neutral", value: `MACD positive but slowing` })
  } else {
    signals.push({ label: "MACD", status: "bearish", value: `MACD bearish (${ta.macd.toFixed(3)})` })
  }

  // ── Bollinger Bands (0-1 pt) ─────────────────────────────────────────────
  if (currentPrice > ta.bbMiddle && currentPrice < ta.bbUpper) {
    points += 1
    signals.push({ label: "BB", status: "bullish", value: `Price in upper BB zone` })
  } else if (currentPrice <= ta.bbLower) {
    signals.push({ label: "BB", status: "bearish", value: `Below lower BB band` })
  } else {
    signals.push({ label: "BB", status: "neutral", value: `Near BB middle` })
  }

  // ── Volume (0-1 pt) ───────────────────────────────────────────────────────
  if (volRatio >= 1.2) {
    points += 1
    signals.push({ label: "Volume", status: "bullish", value: `${(volRatio * 100).toFixed(0)}% of avg (above avg)` })
  } else if (volRatio < 0.7) {
    signals.push({ label: "Volume", status: "bearish", value: `${(volRatio * 100).toFixed(0)}% of avg (drying up)` })
  } else {
    signals.push({ label: "Volume", status: "neutral", value: `${(volRatio * 100).toFixed(0)}% of avg` })
  }

  // ── Clamp points to 0-10 ──────────────────────────────────────────────────
  const clamped = Math.max(0, Math.min(10, points))

  // ── Map to 1-5 score ─────────────────────────────────────────────────────
  let score: SwingScore
  let recommendation: TechnicalScanResult["recommendation"]
  let summary: string

  if (clamped >= 8) {
    score = 5; recommendation = "STRONG BUY"
    summary = `Strong uptrend with ideal RSI entry zone and rising volume — high confidence swing setup`
  } else if (clamped >= 6) {
    score = 4; recommendation = "BUY"
    summary = `Bullish structure confirmed — momentum supports entry on this swing`
  } else if (clamped >= 4) {
    score = 3; recommendation = "WAIT"
    summary = `Mixed signals — wait for clearer trend confirmation before entering`
  } else if (clamped >= 2) {
    score = 2; recommendation = "CAUTION"
    summary = `Bearish signals present — risk/reward is unfavorable for swing entry`
  } else {
    score = 1; recommendation = "AVOID"
    summary = `Downtrend / structure breakdown — avoid new entries, protect capital`
  }

  return { score, recommendation, signals, summary }
}

// ─── Fetch & scan a single ticker ─────────────────────────────────────────────

export async function scanTicker(ticker: string, knownPrice?: number): Promise<TechnicalScanResult | null> {
  try {
    // Use Yahoo Finance for candles (Finnhub free tier no longer supports /stock/candle)
    let candle: Candle
    try {
      candle = await getYahooCandles(ticker.toUpperCase(), "6mo", "1d")
    } catch {
      return null
    }
    if (!candle || candle.c.length < 30) return null

    // Quote: best-effort Finnhub, fall back to derived
    let currentPrice = knownPrice
    if (!currentPrice) {
      try {
        const quote = await getQuote(ticker.toUpperCase())
        currentPrice = quote?.c
      } catch { /* ignore */ }
    }
    if (!currentPrice) {
      const derived = deriveQuoteFromCandle(candle)
      currentPrice = derived?.c || candle.c[candle.c.length - 1]
    }
    if (!currentPrice || currentPrice <= 0) return null

    const ta = getTechnicalAnalysis(candle, currentPrice)
    const volRatio = calcVolumeRatio(candle.v)
    const { score, recommendation, signals, summary } = scoreFromTA(ta, currentPrice, candle.v, candle.c)

    return {
      ticker: ticker.toUpperCase(),
      score,
      recommendation,
      trend: ta.trend,
      rsi: ta.rsi,
      ema20: ta.ema20,
      ema50: ta.ema50,
      ema200: ta.ema200,
      macdHistogram: ta.macdHistogram,
      volumeRatio: volRatio,
      signals,
      summary,
      scannedAt: Date.now(),
      aboveEma20: currentPrice > ta.ema20,
      aboveEma50: currentPrice > ta.ema50,
      aboveEma200: currentPrice > ta.ema200,
      support: ta.support1,
      resistance: ta.resistance1,
    }
  } catch {
    return null
  }
}

// ─── Watchlist scan ───────────────────────────────────────────────────────────

export async function runWatchlistScan(
  watchlistItems: WatchlistItem[]
): Promise<Record<string, TechnicalScanResult>> {
  const results: Record<string, TechnicalScanResult> = {}

  // Scan up to 8 items to stay within API rate limits
  for (const item of watchlistItems.slice(0, 8)) {
    const result = await scanTicker(item.ticker, item.currentPrice)
    if (result) {
      results[item.ticker.toUpperCase()] = result
    }
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 300))
  }

  return results
}

// ─── Speculative position monitoring ─────────────────────────────────────────

interface BreakdownEvent {
  type: "SL_BREACH" | "STRUCTURE_BREAKDOWN" | "EMA20_BREAK" | "RSI_WEAK" | "BEARISH_DIVERGENCE" | "TP_APPROACH"
  impact: "CRITICAL" | "HIGH" | "MEDIUM"
  message: string
  immediateAction: string
}

function detectBreakdown(position: Position, ta: TechnicalAnalysis): BreakdownEvent | null {
  const price  = position.currentPrice
  const sl     = position.stopLoss || 0
  const tp     = position.targetPrice || 0

  // 1. Stop loss breach — CRITICAL
  if (sl > 0 && price <= sl * 1.005) {
    return {
      type: "SL_BREACH", impact: "CRITICAL",
      message: `${position.ticker} has breached stop loss ($${sl.toFixed(2)}) — now at $${price.toFixed(2)}`,
      immediateAction: `EXIT immediately or set hard stop at $${(sl * 0.99).toFixed(2)}. Do NOT average down on CRITICAL breakdown.`,
    }
  }

  // 2. Structure breakdown (below EMA50) — HIGH
  if (price < ta.ema50 && price < ta.ema20 && ta.trend === "downtrend") {
    return {
      type: "STRUCTURE_BREAKDOWN", impact: "HIGH",
      message: `${position.ticker} broke below EMA20 ($${ta.ema20.toFixed(2)}) and EMA50 ($${ta.ema50.toFixed(2)}) — structure invalidated`,
      immediateAction: `REDUCE position by 50%. Move stop loss to $${(Math.max(price * 0.97, sl)).toFixed(2)}. Wait for price to reclaim EMA20 before holding.`,
    }
  }

  // 3. Below EMA20 only — MEDIUM
  if (price < ta.ema20 && ta.rsi < 45) {
    return {
      type: "EMA20_BREAK", impact: "MEDIUM",
      message: `${position.ticker} closed below EMA20 ($${ta.ema20.toFixed(2)}) with RSI ${ta.rsi.toFixed(1)} — early warning`,
      immediateAction: `MONITOR closely. Set alert at $${(ta.ema50 * 0.99).toFixed(2)} (EMA50 level). Tighten stop to $${(Math.max(price * 0.95, sl)).toFixed(2)}.`,
    }
  }

  // 4. Bearish momentum divergence — MEDIUM
  if (ta.rsi < 38 && ta.macdHistogram < 0 && ta.macd < ta.macdSignal) {
    return {
      type: "BEARISH_DIVERGENCE", impact: "MEDIUM",
      message: `${position.ticker} showing bearish divergence — RSI ${ta.rsi.toFixed(1)}, MACD bearish crossover`,
      immediateAction: `Consider REDUCING 25-30% to lock in gains/limit losses. Re-enter if RSI reclaims 50 with MACD bullish.`,
    }
  }

  // 5. Target price approaching (good news!) — MEDIUM
  if (tp > 0 && price >= tp * 0.95) {
    return {
      type: "TP_APPROACH", impact: "MEDIUM",
      message: `${position.ticker} approaching target price $${tp.toFixed(2)} — currently $${price.toFixed(2)} (+${(((price-tp)/tp)*100+100-100).toFixed(1)}% from cost)`,
      immediateAction: `Consider TAKING PROFIT on 40-50% position. Raise stop to breakeven. Let remaining run if trend strong.`,
    }
  }

  return null
}

export async function runSpeculativeScan(
  speculativePositions: Position[],
  prevScans: Record<string, TechnicalScanResult>
): Promise<NewsAlert[]> {
  const alerts: NewsAlert[] = []

  for (const pos of speculativePositions.slice(0, 6)) {
    try {
      const scan = await scanTicker(pos.ticker, pos.currentPrice)
      if (!scan) continue

      // Check for breakdown
      const ta: TechnicalAnalysis = {
        rsi: scan.rsi,
        ema20: scan.ema20,
        ema50: scan.ema50,
        ema100: scan.ema50, // approximate
        ema200: scan.ema200,
        macd: scan.macdHistogram,
        macdSignal: 0,
        macdHistogram: scan.macdHistogram,
        bbUpper: pos.currentPrice * 1.05,
        bbMiddle: pos.currentPrice,
        bbLower: pos.currentPrice * 0.95,
        aboveEma50: scan.aboveEma50,
        aboveEma200: scan.aboveEma200,
        trend: scan.trend,
        signal: scan.recommendation === "STRONG BUY" ? "STRONG BUY"
              : scan.recommendation === "BUY" ? "BUY"
              : scan.recommendation === "AVOID" ? "STRONG SELL"
              : scan.recommendation === "CAUTION" ? "SELL"
              : "NEUTRAL",
        support1: scan.support,
        support2: scan.support * 0.97,
        resistance1: scan.resistance,
        resistance2: scan.resistance * 1.03,
      }

      const event = detectBreakdown(pos, ta)
      if (!event) continue

      // Suppress duplicate alerts: don't fire same type for same ticker within 30 min
      const prev = prevScans[pos.ticker.toUpperCase()]
      if (prev && Date.now() - prev.scannedAt < 30 * 60 * 1000) {
        // Only fire CRITICAL even if recently scanned
        if (event.impact !== "CRITICAL") continue
      }

      const alert: NewsAlert = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        tickers: [pos.ticker],
        headline: event.message,
        source: "Technical Scanner",
        url: "",
        impact: event.impact,
        sentiment: event.type === "TP_APPROACH" ? "BULLISH" : "BEARISH",
        type: "SPECULATIVE",
        portfolioAssessment: buildAssessment(pos, scan, event),
        immediateAction: event.immediateAction,
        swingSetups: [],
        read: false,
        articleId: undefined,
      }

      alerts.push(alert)

      // Small delay between requests
      await new Promise(r => setTimeout(r, 400))
    } catch {
      // ignore individual failures
    }
  }

  return alerts
}

function buildAssessment(pos: Position, scan: TechnicalScanResult, event: BreakdownEvent): string {
  const pnlPct = ((pos.currentPrice - pos.avgCost) / pos.avgCost * 100)
  const pnlStr = `${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(1)}%`

  return [
    `${pos.ticker} technical score: ${scan.score}/5 (${scan.recommendation}).`,
    `Currently ${pnlStr} from avg cost $${pos.avgCost.toFixed(2)}.`,
    `RSI ${scan.rsi.toFixed(1)} | ${scan.aboveEma50 ? "Above" : "Below"} EMA50 | MACD ${scan.macdHistogram > 0 ? "bullish" : "bearish"}.`,
    scan.summary,
  ].join(" ")
}
