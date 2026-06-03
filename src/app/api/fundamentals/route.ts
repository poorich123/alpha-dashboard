/**
 * Yahoo Finance fundamentals proxy — valuation inputs
 * ─────────────────────────────────────────────────────
 *
 * GET /api/fundamentals?symbol=AAPL
 *
 * Returns the raw inputs needed by the Fair Value engine (src/lib/fairValue.ts):
 * free cash flow, growth estimates, shares, beta, EPS, book value, net debt, etc.
 *
 * Uses Yahoo v10 quoteSummary modules (free) via the shared crumb auth, mirroring
 * /api/holdings. Quarterly data → cached 12h server-side.
 */

import { NextResponse } from "next/server"
import { getYahooAuth, withCrumb, yahooHeaders } from "@/lib/yahooCrumb"
import type { FundamentalsRaw } from "@/lib/fairValue"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Minimal shapes for the Yahoo modules we read. Every numeric field is wrapped
// as { raw }, so we pull `.raw` defensively everywhere.
type Num = { raw?: number; fmt?: string } | undefined
interface YahooFundamentals {
  quoteSummary: {
    result?: Array<{
      price?: {
        longName?: string
        shortName?: string
        currency?: string
        quoteType?: string
        regularMarketPrice?: Num
      }
      financialData?: {
        currentPrice?: Num
        freeCashflow?: Num
        operatingCashflow?: Num
        totalCash?: Num
        totalDebt?: Num
        totalRevenue?: Num
        revenueGrowth?: Num
        earningsGrowth?: Num
        returnOnEquity?: Num
        targetMeanPrice?: Num
      }
      defaultKeyStatistics?: {
        sharesOutstanding?: Num
        beta?: Num
        forwardEps?: Num
        trailingEps?: Num
        bookValue?: Num
        enterpriseValue?: Num
        pegRatio?: Num
      }
      summaryDetail?: {
        trailingPE?: Num
        forwardPE?: Num
        marketCap?: Num
        dividendYield?: Num
        beta?: Num
      }
      earningsTrend?: {
        trend?: Array<{
          period?: string          // "0q","+1y","+5y", etc.
          growth?: Num
        }>
      }
      cashflowStatementHistory?: {
        cashflowStatements?: Array<{
          endDate?: Num
          totalCashFromOperatingActivities?: Num
          capitalExpenditures?: Num
        }>
      }
      balanceSheetHistory?: {
        balanceSheetStatements?: Array<{
          endDate?: Num
          totalAssets?: Num
          totalLiab?: Num
          totalStockholderEquity?: Num
        }>
      }
      incomeStatementHistory?: {
        incomeStatementHistory?: Array<{
          endDate?: Num
          netIncome?: Num
          totalRevenue?: Num
        }>
      }
    }>
    error?: { code: string; description: string } | null
  }
}

const num = (n: Num): number | null =>
  n && typeof n.raw === "number" && Number.isFinite(n.raw) ? n.raw : null

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbol = (searchParams.get("symbol") || "").toUpperCase().replace(/\./g, "-")
  if (!symbol) return NextResponse.json({ error: "missing_symbol" }, { status: 400 })

  const modules = [
    "price",
    "financialData",
    "defaultKeyStatistics",
    "summaryDetail",
    "earningsTrend",
    "cashflowStatementHistory",
    "balanceSheetHistory",
    "incomeStatementHistory",
  ].join(",")

  try {
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
      cache: "no-store",
    })

    if (!res.ok) {
      return NextResponse.json({ error: "yahoo_failed", status: res.status }, { status: 502 })
    }

    const data = await res.json() as YahooFundamentals
    const r = data.quoteSummary.result?.[0]
    if (!r) return NextResponse.json({ error: "no_data" }, { status: 502 })

    const fd = r.financialData
    const ks = r.defaultKeyStatistics
    const sd = r.summaryDetail
    const px = r.price

    // ── Free cash flow: prefer financialData.freeCashflow, else operating − capex ──
    let fcf = num(fd?.freeCashflow)
    const cashStmts = r.cashflowStatementHistory?.cashflowStatements || []
    if (fcf == null && cashStmts.length > 0) {
      const op = num(cashStmts[0].totalCashFromOperatingActivities)
      const capex = num(cashStmts[0].capitalExpenditures) // negative in Yahoo
      if (op != null && capex != null) fcf = op + capex
    }

    // Historical FCF series (newest first) for trend / sanity
    const fcfHistory = cashStmts
      .map(s => {
        const op = num(s.totalCashFromOperatingActivities)
        const capex = num(s.capitalExpenditures)
        return op != null && capex != null ? op + capex : null
      })
      .filter((v): v is number => v != null)

    // ── Analyst long-term (+5y) growth, fallback to earnings/revenue growth ──
    const trend = r.earningsTrend?.trend || []
    const ltGrowth = num(trend.find(t => t.period === "+5y")?.growth)
    const nextYrGrowth = num(trend.find(t => t.period === "+1y")?.growth)

    const bs = r.balanceSheetHistory?.balanceSheetStatements?.[0]
    const inc = r.incomeStatementHistory?.incomeStatementHistory?.[0]

    const totalCash = num(fd?.totalCash)
    const totalDebt = num(fd?.totalDebt)

    const snapshot: FundamentalsRaw = {
      ticker: symbol,
      asOf: Date.now(),
      longName: px?.longName || px?.shortName || symbol,
      currency: px?.currency || "USD",
      quoteType: px?.quoteType || "EQUITY",

      currentPrice: num(fd?.currentPrice) ?? num(px?.regularMarketPrice),
      targetMeanPrice: num(fd?.targetMeanPrice),

      freeCashflow: fcf,
      fcfHistory,
      operatingCashflow: num(fd?.operatingCashflow),
      totalRevenue: num(fd?.totalRevenue),
      revenueGrowth: num(fd?.revenueGrowth),
      earningsGrowth: num(fd?.earningsGrowth),
      longTermGrowth: ltGrowth,
      nextYearGrowth: nextYrGrowth,
      returnOnEquity: num(fd?.returnOnEquity),

      sharesOutstanding: num(ks?.sharesOutstanding),
      beta: num(ks?.beta) ?? num(sd?.beta),
      forwardEps: num(ks?.forwardEps),
      trailingEps: num(ks?.trailingEps),
      bookValuePerShare: num(ks?.bookValue),
      enterpriseValue: num(ks?.enterpriseValue),
      pegRatio: num(ks?.pegRatio),

      trailingPE: num(sd?.trailingPE),
      forwardPE: num(sd?.forwardPE),
      marketCap: num(sd?.marketCap),
      dividendYield: num(sd?.dividendYield),

      totalCash,
      totalDebt,
      netDebt: totalCash != null && totalDebt != null ? totalDebt - totalCash : null,

      totalAssets: num(bs?.totalAssets),
      totalLiabilities: num(bs?.totalLiab),
      totalStockholderEquity: num(bs?.totalStockholderEquity),
      netIncome: num(inc?.netIncome),
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
