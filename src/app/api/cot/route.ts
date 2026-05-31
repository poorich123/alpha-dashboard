/**
 * CFTC Commitments of Traders proxy
 * ──────────────────────────────────
 *
 * Wraps CFTC's public Socrata API (publicreporting.cftc.gov).
 * Returns last N weeks of COT data for a given contract, normalized
 * to our CotRecord shape.
 *
 * Two datasets used:
 *   Financial TFF (72hh-3qpy): S&P 500, Nasdaq, Russell, DXY, VIX
 *     — has Leveraged Funds + Asset Managers categories
 *   Disaggregated (kh3c-gbw2): Gold, Oil, Bitcoin
 *     — has Managed Money (≈ hedge funds) + Producers
 *
 * GET /api/cot?contract=sp500&weeks=26
 *
 * Cached server-side for 6 hours (CFTC updates weekly so this is plenty).
 */

import { NextResponse } from "next/server"
import { COT_CONTRACTS, type CotContractKey, type CotRecord } from "@/lib/cftcCot"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Map of contract → which dataset + market filter substring
//
// Verified against Socrata API (CFTC.gov):
//   gpe5-46if = "Traders in Financial Futures (TFF) - Futures Only"
//               Has lev_money_positions_long + asset_mgr_positions_long fields
//   72hh-3qpy = "Disaggregated - Futures Only"
//               Has m_money_positions_long_all + prod_merc_positions_long fields
const DATASET_MAP: Record<CotContractKey, { dataset: string; marketLike: string }> = {
  sp500:   { dataset: "gpe5-46if", marketLike: "E-MINI S&P 500" },
  nasdaq:  { dataset: "gpe5-46if", marketLike: "NASDAQ-100" },
  russell: { dataset: "gpe5-46if", marketLike: "RUSSELL 2000" },
  dxy:     { dataset: "gpe5-46if", marketLike: "U.S. DOLLAR INDEX" },
  vix:     { dataset: "gpe5-46if", marketLike: "VIX FUTURES" },
  gold:    { dataset: "72hh-3qpy", marketLike: "GOLD" },
  oil:     { dataset: "72hh-3qpy", marketLike: "CRUDE OIL, LIGHT SWEET" },
  btc:     { dataset: "72hh-3qpy", marketLike: "BITCOIN" },
}

/**
 * Normalize a Socrata row to CotRecord.
 *
 * Field names differ between TFF and Disaggregated — verified against actual API:
 *
 * TFF (gpe5-46if):
 *   lev_money_positions_long       / lev_money_positions_short       = Leveraged Funds (hedge funds)
 *   asset_mgr_positions_long       / asset_mgr_positions_short       = Asset Managers
 *   dealer_positions_long_all      / dealer_positions_short_all      = Dealers
 *   nonrept_positions_long_all     / nonrept_positions_short_all     = Non-reportable (retail)
 *
 * Disaggregated (72hh-3qpy):
 *   m_money_positions_long_all     / m_money_positions_short_all     = Managed Money (≈ hedge funds)
 *   prod_merc_positions_long       / prod_merc_positions_short       = Producer/Merchant (commercials)
 *   swap_positions_long_all        / swap__positions_short_all       = Swap Dealers (note: DOUBLE underscore!)
 *   nonrept_positions_long_all     / nonrept_positions_short_all     = Non-reportable
 */
function normalizeRow(row: Record<string, unknown>, dataset: string): CotRecord | null {
  const reportDate = String(row.report_date_as_yyyy_mm_dd || "").slice(0, 10)
  const contractName = String(row.market_and_exchange_names || row.contract_market_name || "—")
  const openInterest = Number(row.open_interest_all || 0)
  if (!reportDate || !openInterest) return null

  const isTff = dataset === "gpe5-46if"

  // Leveraged Funds (TFF) / Managed Money (Disaggregated) — hedge funds equivalent
  const levFundLong = Number(
    isTff ? row.lev_money_positions_long : row.m_money_positions_long_all
  ) || 0
  const levFundShort = Number(
    isTff ? row.lev_money_positions_short : row.m_money_positions_short_all
  ) || 0

  // Asset Managers (TFF only) / Swap Dealers (Disaggregated, note double-underscore for short!)
  const assetMgrLong = Number(
    isTff ? row.asset_mgr_positions_long : row.swap_positions_long_all
  ) || 0
  const assetMgrShort = Number(
    isTff ? row.asset_mgr_positions_short : row["swap__positions_short_all"]
  ) || 0

  // Dealers (TFF) / Producer-Merchant (Disaggregated, commercials)
  const dealerLong = Number(
    isTff ? row.dealer_positions_long_all : row.prod_merc_positions_long
  ) || 0
  const dealerShort = Number(
    isTff ? row.dealer_positions_short_all : row.prod_merc_positions_short
  ) || 0

  // Non-reportable (retail) — same field in both datasets
  const nonReptLong  = Number(row.nonrept_positions_long_all  || 0)
  const nonReptShort = Number(row.nonrept_positions_short_all || 0)

  return {
    reportDate,
    contractName,
    openInterest,
    levFundLong,
    levFundShort,
    levFundNet:    levFundLong - levFundShort,
    levFundLongPct:  (levFundLong  / openInterest) * 100,
    levFundShortPct: (levFundShort / openInterest) * 100,
    assetMgrLong,
    assetMgrShort,
    assetMgrNet: assetMgrLong - assetMgrShort,
    dealerLong,
    dealerShort,
    dealerNet: dealerLong - dealerShort,
    nonReptLong,
    nonReptShort,
    nonReptNet: nonReptLong - nonReptShort,
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const contract = (searchParams.get("contract") || "sp500") as CotContractKey
  const weeks = Math.min(52, Math.max(1, Number(searchParams.get("weeks") || 26)))

  const cfg = DATASET_MAP[contract]
  if (!cfg || !COT_CONTRACTS[contract]) {
    return NextResponse.json({ error: "invalid_contract" }, { status: 400 })
  }

  // Build Socrata query — filter by market name + sort by date DESC
  const qs = new URLSearchParams({
    $where: `market_and_exchange_names like '%${cfg.marketLike}%'`,
    $order: "report_date_as_yyyy_mm_dd DESC",
    $limit: String(weeks * 4),  // overfetch — multiple contracts per market name (FUT_ONLY vs COMBINED)
  })
  const url = `https://publicreporting.cftc.gov/resource/${cfg.dataset}.json?${qs}`

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { "Accept": "application/json" },
      // Cache 6 hours (COT only updates weekly)
      next: { revalidate: 6 * 3600 },
    })

    if (!res.ok) {
      const body = await res.text()
      return NextResponse.json(
        { error: "cftc_failed", status: res.status, body: body.slice(0, 200) },
        { status: 502 },
      )
    }

    const raw = await res.json() as Record<string, unknown>[]
    const normalized: CotRecord[] = []
    const seenDates = new Set<string>()

    for (const row of raw) {
      const rec = normalizeRow(row, cfg.dataset)
      if (!rec) continue
      // Dedupe by date — prefer first record per date (Socrata may return multiple contract variants)
      if (seenDates.has(rec.reportDate)) continue
      seenDates.add(rec.reportDate)
      normalized.push(rec)
      if (normalized.length >= weeks) break
    }

    // Compute weekly changes (newest → oldest, so older entry is at higher index)
    for (let i = 0; i < normalized.length - 1; i++) {
      normalized[i].levFundLongChange  = normalized[i].levFundLong  - normalized[i + 1].levFundLong
      normalized[i].levFundShortChange = normalized[i].levFundShort - normalized[i + 1].levFundShort
    }

    return NextResponse.json(normalized, {
      headers: { "Cache-Control": "public, max-age=21600, s-maxage=21600" },
    })
  } catch (err) {
    return NextResponse.json(
      { error: "fetch_failed", message: err instanceof Error ? err.message : "unknown" },
      { status: 502 },
    )
  }
}
