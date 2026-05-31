/**
 * Yahoo Finance institutional holdings proxy
 * ───────────────────────────────────────────
 *
 * GET /api/holdings?symbol=NVDA
 *
 * Returns HoldingsSnapshot with top 10 institutional holders + breakdown.
 * Uses Yahoo quoteSummary modules (free, no auth) — based on most recent
 * SEC 13F filings (45-day delay).
 *
 * Cached 12 hours server-side (filings are quarterly).
 */

import { NextResponse } from "next/server"
import type { HoldingsSnapshot, InstitutionalHolder } from "@/lib/institutionalHoldings"
import { getYahooAuth, withCrumb, yahooHeaders } from "@/lib/yahooCrumb"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface YahooHoldersResponse {
  quoteSummary: {
    result?: Array<{
      institutionOwnership?: {
        ownershipList?: Array<{
          organization?: string
          pctHeld?:    { raw?: number; fmt?: string }
          position?:   { raw?: number }
          value?:      { raw?: number }
          reportDate?: { fmt?: string }
        }>
      }
      majorHoldersBreakdown?: {
        insidersPercentHeld?:     { raw?: number }
        institutionsPercentHeld?: { raw?: number }
        institutionsFloatPercentHeld?: { raw?: number }
        institutionsCount?:       { raw?: number }
      }
    }>
    error?: { code: string; description: string } | null
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbol = (searchParams.get("symbol") || "").toUpperCase().replace(/\./g, "-")
  if (!symbol) return NextResponse.json({ error: "missing_symbol" }, { status: 400 })

  const modules = "institutionOwnership,majorHoldersBreakdown"

  try {
    // Yahoo's v10 quoteSummary endpoint requires crumb auth
    const auth = await getYahooAuth()
    if (!auth) {
      return NextResponse.json(
        { error: "yahoo_auth_failed", message: "Could not obtain Yahoo crumb (may be blocked region)" },
        { status: 502 },
      )
    }

    const url = withCrumb(
      `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}`,
      auth.crumb,
    )

    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: yahooHeaders(auth),
      next: { revalidate: 12 * 3600 },
    })

    if (!res.ok) {
      return NextResponse.json({ error: "yahoo_failed", status: res.status }, { status: 502 })
    }

    const data = await res.json() as YahooHoldersResponse
    const r = data.quoteSummary.result?.[0]
    if (!r) return NextResponse.json({ error: "no_data" }, { status: 502 })

    const topHolders: InstitutionalHolder[] = (r.institutionOwnership?.ownershipList || [])
      .map(h => ({
        organization: h.organization || "—",
        position:     h.position?.raw   || 0,
        pctHeld:      h.pctHeld?.raw    || 0,
        value:        h.value?.raw      || 0,
        reportDate:   h.reportDate?.fmt || "",
      }))
      .filter(h => h.position > 0)
      .slice(0, 10)

    const b = r.majorHoldersBreakdown
    const breakdown = b ? {
      insidersPct:      b.insidersPercentHeld?.raw     || 0,
      institutionsPct:  b.institutionsPercentHeld?.raw || 0,
      floatPct:         b.institutionsFloatPercentHeld?.raw || 0,
      institutionsCount: b.institutionsCount?.raw      || 0,
    } : null

    const snapshot: HoldingsSnapshot = {
      ticker: symbol,
      asOf: Date.now(),
      breakdown,
      topHolders,
    }

    return NextResponse.json(snapshot, {
      headers: { "Cache-Control": "public, max-age=43200, s-maxage=43200" },
    })
  } catch (err) {
    return NextResponse.json(
      { error: "fetch_failed", message: err instanceof Error ? err.message : "unknown" },
      { status: 502 },
    )
  }
}
