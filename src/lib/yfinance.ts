/**
 * Yahoo Finance client wrapper.
 * Uses our /api/yfinance proxy to avoid CORS.
 * Returns Finnhub-compatible Candle shape.
 */

import type { Candle } from "@/types"

const cache = new Map<string, { data: Candle; timestamp: number }>()
const TTL = 5 * 60 * 1000 // 5 minutes

export type YRange = "5d" | "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y" | "max"

export async function getYahooCandles(
  symbol: string,
  range: YRange = "1y",
  interval: "1d" | "1wk" | "1mo" = "1d",
): Promise<Candle> {
  const key = `${symbol}|${range}|${interval}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.timestamp < TTL) return hit.data

  const url = `/api/yfinance?symbol=${encodeURIComponent(symbol)}&range=${range}&interval=${interval}`
  const res = await fetch(url)

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "unknown" }))
    throw new Error(`yfinance: ${body.error || res.status}`)
  }

  const candle = (await res.json()) as Candle
  if (!candle || candle.s !== "ok" || !candle.c?.length) {
    throw new Error("yfinance: no_data")
  }

  cache.set(key, { data: candle, timestamp: Date.now() })
  return candle
}

/**
 * Get the latest quote-like data from a Yahoo candle.
 * Useful when Finnhub /quote also fails.
 */
export function deriveQuoteFromCandle(candle: Candle) {
  const len = candle.c.length
  if (len < 2) return null
  const c  = candle.c[len - 1]
  const pc = candle.c[len - 2]
  return {
    c,
    pc,
    d: c - pc,
    dp: pc > 0 ? ((c - pc) / pc) * 100 : 0,
    h: candle.h[len - 1],
    l: candle.l[len - 1],
    o: candle.o[len - 1],
    v: candle.v[len - 1],
  }
}
