/**
 * CFTC Commitments of Traders (COT) — hedge fund positioning data
 * ──────────────────────────────────────────────────────────────────
 *
 * Source: CFTC.gov public Socrata API (free, no key required)
 *   Financial futures (TFF): https://publicreporting.cftc.gov/resource/72hh-3qpy.json
 *   Disaggregated (commodities + crypto): https://publicreporting.cftc.gov/resource/72hh-3qpy.json
 *
 * Trader categories:
 *   Dealer/Intermediary  — large banks (Goldman, MS, JPM trading desks)
 *   Asset Manager        — institutions (pensions, mutual funds)
 *   Leveraged Funds      — HEDGE FUNDS, CTAs ← the gold here
 *   Other Reportables    — large traders unclassified
 *   Non-Reportable       — small traders (retail)
 *
 * Why it matters:
 *   - When LEVERAGED FUNDS go heavily net-long → hedge funds are crowded long
 *     → contrarian SHORT signal (potential top forming)
 *   - When heavily net-short → contrarian LONG signal (potential bottom)
 *   - Watch z-score of net position vs 1y/3y history for extremes
 *
 * Released: Every Friday 3:30 PM ET, data as of prior Tuesday close.
 *
 * Routed through /api/cot to avoid client CORS (CFTC sets it but we cache server-side).
 */

export interface CotRecord {
  reportDate: string         // YYYY-MM-DD
  contractName: string

  // Open Interest (raw contracts)
  openInterest: number

  // Leveraged Funds = HEDGE FUNDS (the signal)
  levFundLong: number
  levFundShort: number
  levFundNet: number          // long - short
  levFundLongPct: number      // % of total OI
  levFundShortPct: number

  // Asset Managers = mutual funds, pensions
  assetMgrLong: number
  assetMgrShort: number
  assetMgrNet: number

  // Dealers = bank trading desks
  dealerLong: number
  dealerShort: number
  dealerNet: number

  // Non-reportable = retail
  nonReptLong: number
  nonReptShort: number
  nonReptNet: number

  // Weekly changes
  levFundLongChange?: number
  levFundShortChange?: number
}

/** Pre-defined contracts of interest with their CFTC market names */
export const COT_CONTRACTS = {
  sp500:   { label: "S&P 500 (E-mini)",  market: "E-MINI S&P 500",          emoji: "📈" },
  nasdaq:  { label: "Nasdaq-100",        market: "NASDAQ-100 Consolidated", emoji: "💻" },
  russell: { label: "Russell 2000",      market: "RUSSELL E-MINI",          emoji: "🇺🇸" },
  dxy:     { label: "Dollar Index",      market: "U.S. DOLLAR INDEX",       emoji: "💵", deprecated: true },
  vix:     { label: "VIX",               market: "VIX FUTURES",             emoji: "😱" },
  gold:    { label: "Gold",              market: "GOLD",                    emoji: "🥇" },
  oil:     { label: "Crude Oil (WTI)",   market: "CRUDE OIL, LIGHT SWEET-WTI", emoji: "🛢️" },
  btc:     { label: "Bitcoin",           market: "BITCOIN",                 emoji: "₿"  },
} as const

export type CotContractKey = keyof typeof COT_CONTRACTS

/**
 * Compute a positioning extreme z-score from a history of net positions.
 * Returns value in standard deviations from mean.
 *   z > 2 = bullish extreme (crowded long → contrarian SHORT)
 *   z < -2 = bearish extreme (crowded short → contrarian LONG)
 */
export function computePositioningZScore(history: number[]): number {
  if (history.length < 8) return 0
  const mean = history.reduce((a, b) => a + b, 0) / history.length
  const variance = history.reduce((acc, v) => acc + (v - mean) ** 2, 0) / history.length
  const std = Math.sqrt(variance)
  if (std === 0) return 0
  const latest = history[0]  // history sorted DESC
  return (latest - mean) / std
}

/**
 * Interpret a z-score as a tradeable signal.
 */
export function interpretPositioning(z: number): {
  signal: "EXTREME LONG" | "ELEVATED LONG" | "NEUTRAL" | "ELEVATED SHORT" | "EXTREME SHORT"
  contrarian: "STRONG SHORT" | "WEAK SHORT" | "WAIT" | "WEAK LONG" | "STRONG LONG"
  color: string
  tip: string
} {
  if (z >= 2)        return { signal: "EXTREME LONG",   contrarian: "STRONG SHORT", color: "text-red-400",     tip: "Hedge funds crowded long — fade the trade (contrarian SHORT)" }
  if (z >= 1)        return { signal: "ELEVATED LONG",  contrarian: "WEAK SHORT",   color: "text-orange-400",  tip: "Long positioning getting crowded — caution on chasing longs" }
  if (z <= -2)       return { signal: "EXTREME SHORT",  contrarian: "STRONG LONG",  color: "text-emerald-400", tip: "Hedge funds crowded short — fade the trade (contrarian LONG)" }
  if (z <= -1)       return { signal: "ELEVATED SHORT", contrarian: "WEAK LONG",    color: "text-cyan-400",    tip: "Short positioning getting crowded — caution on chasing shorts" }
  return { signal: "NEUTRAL", contrarian: "WAIT", color: "text-gray-400", tip: "No extreme positioning — wait for clearer signal" }
}

/** Fetch via our API route, bypassing browser cache. Server enforces its own. */
export async function fetchCotHistory(
  contract: CotContractKey,
  weeks = 26,
): Promise<CotRecord[]> {
  // Cache-busting query param ensures no browser/CDN serves a stale response
  // from when the API was broken.
  const url = `/api/cot?contract=${contract}&weeks=${weeks}&_t=${Date.now()}`
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "unknown" }))
    throw new Error(body.error || body.message || `HTTP ${res.status}`)
  }
  return await res.json() as CotRecord[]
}
