/**
 * Conviction Fund Tracker
 * ────────────────────────
 * Tracks a hand-picked roster of high-conviction managers via their SEC 13F-HR
 * filings — what they ADDED / CUT / opened (NEW) / closed (EXIT) quarter-over-
 * quarter, with $ amounts and overlap against your own portfolio.
 *
 * This replaces the *passive* per-stock 13F lookup (who holds NVDA) with an
 * *active* fund-centric view (what the smart money is actually doing).
 *
 * Data: SEC EDGAR (free, official) via /api/fund-holdings. CUSIP→ticker is
 * resolved server-side with OpenFIGI. 13F lags real trades by 45 days (quarterly).
 *
 * NOT investment advice — 13F shows long US-listed equity positions only, after
 * a delay, and excludes shorts, non-US, and most derivatives.
 */

export interface ConvictionFund {
  key: string
  manager: string
  fund: string
  cik: string        // 10-digit, zero-padded
  emoji: string
  blurb: string
}

/** CIKs verified live against data.sec.gov (all have ≥2 quarters of 13F-HR). */
export const CONVICTION_FUNDS: ConvictionFund[] = [
  { key: "duquesne",    manager: "Stanley Druckenmiller", fund: "Duquesne Family Office",   cik: "0001536411", emoji: "🦅", blurb: "Macro legend · เน้นไม้ใหญ่ เปลี่ยนพอร์ตเร็ว" },
  { key: "pershing",    manager: "Bill Ackman",           fund: "Pershing Square Capital",  cik: "0001336528", emoji: "🎯", blurb: "Activist · ~8-12 ตัว conviction สูง" },
  { key: "tiger",       manager: "Chase Coleman",         fund: "Tiger Global Management",  cik: "0001167483", emoji: "🐯", blurb: "Growth/tech · ถือยาว" },
  { key: "coatue",      manager: "Philippe Laffont",      fund: "Coatue Management",        cik: "0001135730", emoji: "🌊", blurb: "TMT/tech growth" },
  { key: "situational", manager: "Leopold Aschenbrenner", fund: "Situational Awareness LP", cik: "0002045724", emoji: "🤖", blurb: "AI-thesis fund · ใช้ options เยอะ" },
  { key: "appaloosa",   manager: "David Tepper",          fund: "Appaloosa LP",             cik: "0001656456", emoji: "🐎", blurb: "Opportunistic macro/value · tech-heavy · กระจุกไม้ใหญ่" },
  { key: "berkshire",   manager: "Warren Buffett",        fund: "Berkshire Hathaway",       cik: "0001067983", emoji: "🧙", blurb: "Value icon · ถือยาวมาก · มูลค่า+คุณภาพ" },
  { key: "altimeter",   manager: "Brad Gerstner",         fund: "Altimeter Capital",        cik: "0001541617", emoji: "🚀", blurb: "AI/tech กระจุก · AI supercycle thesis (growth/momentum)" },
  { key: "whalerock",   manager: "Alex Sacerdote",        fund: "Whale Rock Capital",       cik: "0001387322", emoji: "🐋", blurb: "Tech growth/momentum เฉพาะทาง" },
  { key: "lonepine",    manager: "Stephen Mandel",        fund: "Lone Pine Capital",        cik: "0001061165", emoji: "🌲", blurb: "Tiger cub · GARP/growth" },
  { key: "ark",         manager: "Cathie Wood",           fund: "ARK Investment Management", cik: "0001697748", emoji: "🌙", blurb: "Disruptive innovation · momentum/beta สูง · เก็งกำไรจัด" },
]

export type FundKey = (typeof CONVICTION_FUNDS)[number]["key"]

export function fundByKey(key: string): ConvictionFund | undefined {
  return CONVICTION_FUNDS.find(f => f.key === key)
}

// ─── Holdings types (shared with /api/fund-holdings) ───────────────────────────

export type ChangeType = "NEW" | "ADD" | "TRIM" | "EXIT" | "HOLD"

export interface FundHolding {
  cusip: string
  ticker: string | null
  issuer: string
  value: number              // USD this quarter (0 for EXIT)
  shares: number
  pctOfPortfolio: number     // value / totalValue (0-1)
  changeType: ChangeType
  deltaValue: number         // USD change vs prior quarter
  deltaShares: number
  deltaPct: number | null    // share change %, null for NEW/EXIT
}

export interface FundHoldingsSnapshot {
  cik: string
  fund: string
  asOf: number
  latestQuarter: string      // reportDate YYYY-MM-DD
  priorQuarter: string | null
  totalValue: number
  holdingsCount: number
  optionsExcluded: number    // # option rows dropped (puts/calls)
  newCount: number
  addCount: number
  trimCount: number
  exitCount: number
  holdings: FundHolding[]     // sorted by value desc (exits last)
}

// ─── Client fetch (mirrors fetchFundamentals / fetchHoldings) ──────────────────

export async function fetchFundHoldings(cik: string): Promise<FundHoldingsSnapshot> {
  const res = await fetch(
    `/api/fund-holdings?cik=${encodeURIComponent(cik)}&_t=${Date.now()}`,
    { cache: "no-store" },
  )
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "unknown" }))
    throw new Error(body.error || body.message || `HTTP ${res.status}`)
  }
  return await res.json() as FundHoldingsSnapshot
}

// ─── Portfolio overlap ──────────────────────────────────────────────────────────

/**
 * Which fund holdings overlap the user's portfolio (by resolved ticker).
 * Returns a Set of tickers held by both for O(1) lookup in the UI.
 */
export function computeOverlap(
  holdings: FundHolding[],
  portfolioTickers: string[],
): Set<string> {
  const port = new Set(portfolioTickers.map(t => t.toUpperCase()))
  const overlap = new Set<string>()
  for (const h of holdings) {
    if (h.ticker && port.has(h.ticker.toUpperCase())) overlap.add(h.ticker.toUpperCase())
  }
  return overlap
}

// ─── Display helpers ─────────────────────────────────────────────────────────────

export const CHANGE_META: Record<ChangeType, { label: string; color: string; bg: string }> = {
  NEW:  { label: "NEW",  color: "text-emerald-300", bg: "bg-emerald-500/15 border-emerald-500/40" },
  ADD:  { label: "ADD",  color: "text-green-300",   bg: "bg-green-500/10 border-green-500/30" },
  HOLD: { label: "HOLD", color: "text-gray-400",    bg: "bg-gray-700/30 border-gray-700" },
  TRIM: { label: "TRIM", color: "text-orange-300",  bg: "bg-orange-500/10 border-orange-500/30" },
  EXIT: { label: "EXIT", color: "text-red-300",     bg: "bg-red-500/15 border-red-500/40" },
}

export function fmtUsd(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? "-" : ""
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`
  return `${sign}$${abs.toFixed(0)}`
}
