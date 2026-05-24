/**
 * Yahoo Finance proxy API route
 * ──────────────────────────────
 * Fetches OHLCV candle data from Yahoo Finance's public chart endpoint.
 * Free, no API key required. Server-side to avoid CORS issues.
 *
 * GET /api/yfinance?symbol=NVDA&range=1y&interval=1d
 *
 * Returns Finnhub-compatible Candle shape:
 *   { s: "ok", t: [], o: [], h: [], l: [], c: [], v: [] }
 */

import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface YahooChartResponse {
  chart: {
    result?: Array<{
      meta?: { regularMarketPrice?: number; symbol?: string }
      timestamp?: number[]
      indicators?: {
        quote?: Array<{
          open?: (number | null)[]
          high?: (number | null)[]
          low?:  (number | null)[]
          close?: (number | null)[]
          volume?: (number | null)[]
        }>
      }
    }>
    error?: { code: string; description: string } | null
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const rawSymbol = (searchParams.get("symbol") || "").toUpperCase()
  const range     = searchParams.get("range")    || "1y"
  const interval  = searchParams.get("interval") || "1d"

  if (!rawSymbol) {
    return NextResponse.json({ s: "no_data", error: "missing symbol" }, { status: 400 })
  }

  // Yahoo uses dash for class shares (BRK-B, BF-B, RDS-A), but
  // S&P 500 canonical format uses dot (BRK.B, BF.B). Normalize here.
  const symbol = rawSymbol.replace(/\./g, "-")

  // Yahoo Finance has two mirror hosts; try both
  const hosts = [
    "https://query1.finance.yahoo.com",
    "https://query2.finance.yahoo.com",
  ]

  let lastErr = ""

  for (const host of hosts) {
    const url = `${host}/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false`

    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json",
          "Accept-Language": "en-US,en;q=0.9",
        },
        // Brief timeout so we can try the second host
        signal: AbortSignal.timeout(8000),
      })

      if (!res.ok) {
        lastErr = `Yahoo ${host} returned ${res.status}`
        continue
      }

      const data = (await res.json()) as YahooChartResponse

      if (data.chart.error) {
        lastErr = data.chart.error.description
        continue
      }

      const result = data.chart.result?.[0]
      const quote  = result?.indicators?.quote?.[0]
      const ts     = result?.timestamp

      if (!result || !quote || !ts || ts.length === 0) {
        lastErr = "No data returned from Yahoo"
        continue
      }

      // Filter out nulls (Yahoo sometimes inserts nulls for missing days)
      const idx = ts.map((_, i) =>
        quote.close?.[i] != null && quote.open?.[i] != null && quote.high?.[i] != null && quote.low?.[i] != null
      )

      const candle = {
        s: "ok",
        t: ts.filter((_, i) => idx[i]),
        o: (quote.open  || []).filter((_, i) => idx[i]) as number[],
        h: (quote.high  || []).filter((_, i) => idx[i]) as number[],
        l: (quote.low   || []).filter((_, i) => idx[i]) as number[],
        c: (quote.close || []).filter((_, i) => idx[i]) as number[],
        v: (quote.volume|| []).filter((_, i) => idx[i]).map(v => v ?? 0) as number[],
        meta: result.meta || {},
      }

      if (candle.c.length === 0) {
        lastErr = "Empty candle data"
        continue
      }

      return NextResponse.json(candle, {
        headers: {
          // Cache for 5 minutes — same as Finnhub TTL
          "Cache-Control": "public, max-age=300, s-maxage=300",
        },
      })
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err)
      continue
    }
  }

  return NextResponse.json(
    { s: "no_data", error: lastErr || "All Yahoo hosts failed" },
    { status: 502 },
  )
}
