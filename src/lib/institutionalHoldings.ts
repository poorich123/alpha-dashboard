/**
 * Institutional Holdings — 13F proxy via Yahoo Finance
 * ──────────────────────────────────────────────────────
 *
 * "True" prime brokerage data is proprietary (Goldman GS Prime Services,
 * MS PB) and only available to actual hedge fund clients. The closest
 * public proxy is the SEC 13F filing — quarterly snapshot of institutional
 * holdings >$100M, filed 45 days after quarter end.
 *
 * Sources:
 *   - Yahoo quoteSummary modules: institutionOwnership (top holders),
 *     majorHoldersBreakdown (% institutional vs insider vs float)
 *     ✓ Free, no auth
 *     ⚠️ Lagging (45-day filing delay) — quarterly snapshot
 *   - SEC EDGAR full 13F filings: requires User-Agent + rate-limit handling
 *     ✓ Full disclosure
 *     ⚠️ More implementation work
 *
 * For now we use Yahoo. Future enhancement: scrape SEC EDGAR for specific
 * famous funds (Buffett/Berkshire, Burry/Scion, Soros, Pershing, etc.) and
 * surface their top buys/sells per quarter.
 *
 * Released: 45 days after each quarter end (Feb 14, May 15, Aug 14, Nov 14).
 */

export interface InstitutionalHolder {
  organization: string         // fund name
  position: number             // shares held
  pctHeld: number              // % of float
  value: number                // USD market value
  reportDate: string           // YYYY-MM-DD
}

export interface OwnershipBreakdown {
  insidersPct: number          // % held by insiders
  institutionsPct: number      // % held by institutions
  floatPct: number             // institutional % of float
  institutionsCount: number    // number of institutions
}

export interface HoldingsSnapshot {
  ticker: string
  asOf: number
  breakdown: OwnershipBreakdown | null
  topHolders: InstitutionalHolder[]
}

export async function fetchHoldings(ticker: string): Promise<HoldingsSnapshot> {
  const res = await fetch(`/api/holdings?symbol=${encodeURIComponent(ticker)}`)
  if (!res.ok) throw new Error(`Holdings fetch failed: ${res.status}`)
  return await res.json() as HoldingsSnapshot
}

/**
 * Heuristic: compute a "smart money sentiment" score 0-100 from holders.
 * Higher = more institutional confidence.
 *
 * Inputs that boost score:
 *   - High institutional ownership % (>60%)
 *   - High number of distinct institutions (>500)
 *   - Top holders include well-known long-term funds (Vanguard, BlackRock,
 *     Fidelity, State Street)
 */
export function computeSmartMoneyScore(snap: HoldingsSnapshot): {
  score: number
  signal: "STRONG" | "MODERATE" | "WEAK" | "UNKNOWN"
  reasons: string[]
} {
  if (!snap.breakdown) return { score: 0, signal: "UNKNOWN", reasons: ["No data"] }

  let score = 0
  const reasons: string[] = []

  const instPct = snap.breakdown.institutionsPct * 100
  if (instPct >= 80) { score += 35; reasons.push(`${instPct.toFixed(0)}% institutional ownership (very high)`) }
  else if (instPct >= 60) { score += 25; reasons.push(`${instPct.toFixed(0)}% institutional ownership (high)`) }
  else if (instPct >= 40) { score += 15; reasons.push(`${instPct.toFixed(0)}% institutional ownership (moderate)`) }
  else { reasons.push(`Only ${instPct.toFixed(0)}% institutional — retail/insider dominated`) }

  const count = snap.breakdown.institutionsCount
  if (count >= 2000) { score += 25; reasons.push(`${count.toLocaleString()} institutions hold (broad coverage)`) }
  else if (count >= 800) { score += 15; reasons.push(`${count.toLocaleString()} institutions hold (good coverage)`) }
  else if (count >= 200) { score += 8 }

  // Quality holders
  const blueChips = ["VANGUARD", "BLACKROCK", "FIDELITY", "STATE STREET", "JPMORGAN", "GEODE", "MORGAN STANLEY", "T. ROWE"]
  const blueChipHolders = snap.topHolders.filter(h =>
    blueChips.some(bc => h.organization.toUpperCase().includes(bc))
  )
  if (blueChipHolders.length >= 3) {
    score += 25
    reasons.push(`Top holders include ${blueChipHolders.length} blue-chip funds (Vanguard/BlackRock/Fidelity)`)
  } else if (blueChipHolders.length >= 1) {
    score += 15
  }

  // Insider stake
  const insPct = snap.breakdown.insidersPct * 100
  if (insPct >= 10) { score += 15; reasons.push(`${insPct.toFixed(1)}% insider stake (high alignment)`) }
  else if (insPct >= 3) { score += 5 }

  const finalScore = Math.min(100, score)
  const signal: ReturnType<typeof computeSmartMoneyScore>["signal"] =
    finalScore >= 70 ? "STRONG" :
    finalScore >= 40 ? "MODERATE" : "WEAK"

  return { score: finalScore, signal, reasons }
}
