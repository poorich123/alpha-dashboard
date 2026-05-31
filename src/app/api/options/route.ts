/**
 * Yahoo Finance options chain proxy
 * ──────────────────────────────────
 *
 * GET /api/options?symbol=SPY&expirations=3
 *
 * Returns OptionsChain shape — aggregated across N nearest expirations.
 * Default 3 expirations (covers next ~6 weeks for SPY).
 *
 * Yahoo endpoint: https://query2.finance.yahoo.com/v7/finance/options/SPY
 *   First call returns expirationDates array + nearest expiry
 *   Pass ?date=<unix> to get a specific expiry
 *
 * Cached 15 min server-side (OI updates daily after close).
 */

import { NextResponse } from "next/server"
import type { OptionsChain, OptionContract } from "@/lib/dealerGamma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface YahooOptionContract {
  contractSymbol: string
  strike: number
  currency?: string
  lastPrice?: number
  change?: number
  percentChange?: number
  volume?: number
  openInterest?: number
  bid?: number
  ask?: number
  contractSize?: string
  expiration: number
  lastTradeDate?: number
  impliedVolatility?: number
  inTheMoney?: boolean
}

interface YahooOptionsResponse {
  optionChain: {
    result?: Array<{
      underlyingSymbol: string
      expirationDates: number[]
      strikes: number[]
      quote: {
        regularMarketPrice: number
      }
      options: Array<{
        expirationDate: number
        hasMiniOptions: boolean
        calls: YahooOptionContract[]
        puts:  YahooOptionContract[]
      }>
    }>
    error?: { code: string; description: string }
  }
}

function normalize(c: YahooOptionContract, expiration: number): OptionContract {
  return {
    strike: c.strike,
    lastPrice: c.lastPrice ?? 0,
    openInterest: c.openInterest ?? 0,
    impliedVolatility: c.impliedVolatility ?? 0,
    inTheMoney: c.inTheMoney ?? false,
    expiration,
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbol = (searchParams.get("symbol") || "SPY").toUpperCase().replace(/\./g, "-")
  const numExpirations = Math.max(1, Math.min(6, Number(searchParams.get("expirations") || 3)))

  try {
    // 1. Initial call — get expiration list + first chain
    const firstUrl = `https://query2.finance.yahoo.com/v7/finance/options/${encodeURIComponent(symbol)}`
    const firstRes = await fetch(firstUrl, {
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
      },
      next: { revalidate: 900 },  // 15 min
    })

    if (!firstRes.ok) {
      return NextResponse.json({ error: "yahoo_initial_failed", status: firstRes.status }, { status: 502 })
    }

    const firstData = await firstRes.json() as YahooOptionsResponse
    const result = firstData.optionChain.result?.[0]
    if (!result) {
      return NextResponse.json({ error: "no_chain_data" }, { status: 502 })
    }

    const spotPrice = result.quote.regularMarketPrice
    const expirations = result.expirationDates.slice(0, numExpirations)

    // Aggregate across expirations
    const allCalls: OptionContract[] = []
    const allPuts:  OptionContract[] = []

    // First expiration already loaded
    if (result.options?.[0]) {
      const opt = result.options[0]
      for (const c of opt.calls) allCalls.push(normalize(c, opt.expirationDate))
      for (const p of opt.puts)  allPuts.push(normalize(p,  opt.expirationDate))
    }

    // Fetch remaining expirations
    for (const exp of expirations.slice(1)) {
      try {
        const expUrl = `https://query2.finance.yahoo.com/v7/finance/options/${encodeURIComponent(symbol)}?date=${exp}`
        const expRes = await fetch(expUrl, {
          signal: AbortSignal.timeout(6000),
          headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
          next: { revalidate: 900 },
        })
        if (!expRes.ok) continue
        const expData = await expRes.json() as YahooOptionsResponse
        const expOpt = expData.optionChain.result?.[0]?.options?.[0]
        if (!expOpt) continue
        for (const c of expOpt.calls) allCalls.push(normalize(c, expOpt.expirationDate))
        for (const p of expOpt.puts)  allPuts.push(normalize(p,  expOpt.expirationDate))
      } catch {
        // Continue on partial failure
      }
    }

    const out: OptionsChain = {
      symbol,
      spotPrice,
      expirations,
      calls: allCalls,
      puts:  allPuts,
      fetchedAt: Date.now(),
    }

    return NextResponse.json(out, {
      headers: { "Cache-Control": "public, max-age=900, s-maxage=900" },
    })
  } catch (err) {
    return NextResponse.json(
      { error: "fetch_failed", message: err instanceof Error ? err.message : "unknown" },
      { status: 502 },
    )
  }
}
