/**
 * SEC EDGAR 13F-HR fund holdings + quarter-over-quarter diff
 * ───────────────────────────────────────────────────────────
 *
 * GET /api/fund-holdings?cik=0001336528
 *
 * Pulls the latest two 13F-HR filings for a fund, parses the information table,
 * aggregates long share positions by CUSIP (options excluded), diffs the two
 * quarters into NEW/ADD/TRIM/EXIT, and resolves CUSIP→ticker via OpenFIGI.
 *
 * SEC requires a descriptive User-Agent. Modern 13F (2023+) reports `value` in
 * actual dollars (not thousands). Cached 12h server-side (filings are quarterly).
 */

import { NextResponse } from "next/server"
import type { ChangeType, FundHolding, FundHoldingsSnapshot } from "@/lib/convictionFunds"
import { CONVICTION_FUNDS } from "@/lib/convictionFunds"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SEC_UA = process.env.SEC_USER_AGENT || "AlphaDashboard/1.0 (contact: alpha-dashboard@example.com)"
const OPENFIGI_KEY = process.env.OPENFIGI_API_KEY || ""

const MAX_ACTIVE = 25
const MAX_EXITS = 10

// ─── Server-side caches ──────────────────────────────────────────────────────
const snapCache = new Map<string, { data: FundHoldingsSnapshot; expires: number }>()
const SNAP_TTL = 12 * 60 * 60 * 1000
const cusipTickerCache = new Map<string, string | null>()  // persistent for process

async function secFetch(url: string): Promise<Response> {
  return fetch(url, {
    headers: { "User-Agent": SEC_UA, "Accept": "application/json, text/plain, */*" },
    signal: AbortSignal.timeout(9000),
    cache: "no-store",
  })
}

// ─── 13F information-table parser (namespace-prefix agnostic) ───────────────────
interface RawRow { issuer: string; cusip: string; value: number; shares: number; isOption: boolean }

function tagVal(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<(?:[\\w.-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:[\\w.-]+:)?${tag}>`, "i"))
  return m ? m[1].trim() : null
}

function parseInfoTable(xml: string): RawRow[] {
  const blocks = xml.match(/<(?:[\w.-]+:)?infoTable\b[^>]*>[\s\S]*?<\/(?:[\w.-]+:)?infoTable>/gi) || []
  const rows: RawRow[] = []
  for (const b of blocks) {
    const cusip = tagVal(b, "cusip")
    const valueStr = tagVal(b, "value")
    if (!cusip || !valueStr) continue
    const sshType = tagVal(b, "sshPrnamtType")
    const putCall = tagVal(b, "putCall")
    rows.push({
      issuer: tagVal(b, "nameOfIssuer") || "—",
      cusip: cusip.toUpperCase(),
      value: parseInt(valueStr.replace(/[^0-9]/g, ""), 10) || 0,  // modern filings = dollars
      shares: sshType === "SH" ? (parseInt((tagVal(b, "sshPrnamt") || "0").replace(/[^0-9]/g, ""), 10) || 0) : 0,
      isOption: !!(putCall && putCall.trim()),
    })
  }
  return rows
}

/** Aggregate long share positions (exclude options) by CUSIP. */
function aggregate(rows: RawRow[]): { map: Map<string, { issuer: string; value: number; shares: number }>; optionRows: number } {
  const map = new Map<string, { issuer: string; value: number; shares: number }>()
  let optionRows = 0
  for (const r of rows) {
    if (r.isOption) { optionRows++; continue }
    if (r.shares <= 0) continue   // skip bonds / principal-amount rows
    const cur = map.get(r.cusip)
    if (cur) { cur.value += r.value; cur.shares += r.shares }
    else map.set(r.cusip, { issuer: r.issuer, value: r.value, shares: r.shares })
  }
  return { map, optionRows }
}

// ─── Resolve one filing's holdings ──────────────────────────────────────────────
async function loadFilingHoldings(cikNum: string, accession: string) {
  const accNoDash = accession.replace(/-/g, "")
  const base = `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accNoDash}`

  const idxRes = await secFetch(`${base}/index.json`)
  if (!idxRes.ok) throw new Error(`index ${idxRes.status}`)
  const idx = await idxRes.json() as { directory: { item: Array<{ name: string }> } }
  const xmlName = idx.directory.item
    .map(i => i.name)
    .find(n => n.toLowerCase().endsWith(".xml") && !n.toLowerCase().includes("primary"))
  if (!xmlName) throw new Error("no infotable xml")

  const xmlRes = await secFetch(`${base}/${xmlName}`)
  if (!xmlRes.ok) throw new Error(`infotable ${xmlRes.status}`)
  const xml = await xmlRes.text()
  return aggregate(parseInfoTable(xml))
}

// ─── CUSIP → ticker via OpenFIGI (batched, cached) ──────────────────────────────
async function resolveTickers(cusips: string[]): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>()
  const need: string[] = []
  for (const c of cusips) {
    if (cusipTickerCache.has(c)) out.set(c, cusipTickerCache.get(c)!)
    else need.push(c)
  }
  if (need.length === 0) return out

  const batchSize = OPENFIGI_KEY ? 100 : 10
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (OPENFIGI_KEY) headers["X-OPENFIGI-APIKEY"] = OPENFIGI_KEY

  for (let i = 0; i < need.length; i += batchSize) {
    const batch = need.slice(i, i + batchSize)
    try {
      const res = await fetch("https://api.openfigi.com/v3/mapping", {
        method: "POST",
        headers,
        body: JSON.stringify(batch.map(c => ({ idType: "ID_CUSIP", idValue: c }))),
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) { batch.forEach(c => out.set(c, null)); continue }
      const data = await res.json() as Array<{ data?: Array<{ ticker?: string; exchCode?: string }> }>
      batch.forEach((c, j) => {
        const entries = data[j]?.data || []
        // Prefer a US-listed common ticker; else first available.
        const us = entries.find(e => e.exchCode === "US" && e.ticker)
        const ticker = (us?.ticker || entries[0]?.ticker || null)?.toUpperCase() || null
        cusipTickerCache.set(c, ticker)
        out.set(c, ticker)
      })
    } catch {
      batch.forEach(c => out.set(c, null))
    }
  }
  return out
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const rawCik = (searchParams.get("cik") || "").replace(/[^0-9]/g, "")
  if (!rawCik) return NextResponse.json({ error: "missing_cik" }, { status: 400 })

  const cik10 = rawCik.padStart(10, "0")
  const cikNum = String(parseInt(rawCik, 10))
  const fundMeta = CONVICTION_FUNDS.find(f => f.cik === cik10)

  const cached = snapCache.get(cik10)
  if (cached && Date.now() < cached.expires) return NextResponse.json(cached.data)

  try {
    // 1. Latest two 13F-HR filings from submissions
    const subRes = await secFetch(`https://data.sec.gov/submissions/CIK${cik10}.json`)
    if (!subRes.ok) return NextResponse.json({ error: "sec_submissions_failed", status: subRes.status }, { status: 502 })
    const sub = await subRes.json() as {
      name: string
      filings: { recent: { form: string[]; accessionNumber: string[]; reportDate: string[] } }
    }
    const f = sub.filings.recent
    const filings = f.form
      .map((form, i) => ({ form, accession: f.accessionNumber[i], reportDate: f.reportDate[i] }))
      .filter(x => x.form === "13F-HR")
    if (filings.length === 0) {
      return NextResponse.json({ error: "no_13f", message: "กองนี้ยังไม่มี 13F-HR" }, { status: 404 })
    }

    const latest = filings[0]
    const prior = filings[1] || null

    // 2. Load holdings (sequential — gentle on SEC rate limits)
    const latestAgg = await loadFilingHoldings(cikNum, latest.accession)
    const priorAgg = prior ? await loadFilingHoldings(cikNum, prior.accession) : null

    const totalValue = [...latestAgg.map.values()].reduce((s, h) => s + h.value, 0) || 1

    // 3. Diff latest vs prior
    const holdings: FundHolding[] = []
    const priorMap = priorAgg?.map

    for (const [cusip, h] of latestAgg.map) {
      const p = priorMap?.get(cusip)
      let changeType: ChangeType
      let deltaShares = 0
      let deltaPct: number | null = null
      if (!priorMap) {
        changeType = "HOLD"
      } else if (!p) {
        changeType = "NEW"
      } else {
        deltaShares = h.shares - p.shares
        deltaPct = p.shares > 0 ? deltaShares / p.shares : null
        const thresh = p.shares * 0.02
        changeType = deltaShares > thresh ? "ADD" : deltaShares < -thresh ? "TRIM" : "HOLD"
      }
      holdings.push({
        cusip, ticker: null, issuer: h.issuer,
        value: h.value, shares: h.shares,
        pctOfPortfolio: h.value / totalValue,
        changeType, deltaShares,
        deltaValue: h.value - (p?.value ?? 0),
        deltaPct,
      })
    }

    // Exits: in prior, gone from latest
    const exits: FundHolding[] = []
    if (priorMap) {
      for (const [cusip, p] of priorMap) {
        if (!latestAgg.map.has(cusip)) {
          exits.push({
            cusip, ticker: null, issuer: p.issuer,
            value: 0, shares: 0, pctOfPortfolio: 0,
            changeType: "EXIT", deltaShares: -p.shares,
            deltaValue: -p.value, deltaPct: -1,
          })
        }
      }
    }

    holdings.sort((a, b) => b.value - a.value)
    exits.sort((a, b) => a.deltaValue - b.deltaValue)  // biggest exit first
    const display = [...holdings.slice(0, MAX_ACTIVE), ...exits.slice(0, MAX_EXITS)]

    // 4. CUSIP → ticker for displayed rows
    const tickerMap = await resolveTickers(display.map(h => h.cusip))
    for (const h of display) h.ticker = tickerMap.get(h.cusip) ?? null

    const snapshot: FundHoldingsSnapshot = {
      cik: cik10,
      fund: fundMeta?.fund || sub.name,
      asOf: Date.now(),
      latestQuarter: latest.reportDate,
      priorQuarter: prior?.reportDate || null,
      totalValue,
      holdingsCount: latestAgg.map.size,
      optionsExcluded: latestAgg.optionRows,
      newCount: holdings.filter(h => h.changeType === "NEW").length,
      addCount: holdings.filter(h => h.changeType === "ADD").length,
      trimCount: holdings.filter(h => h.changeType === "TRIM").length,
      exitCount: exits.length,
      holdings: display,
    }

    snapCache.set(cik10, { data: snapshot, expires: Date.now() + SNAP_TTL })
    return NextResponse.json(snapshot)
  } catch (err) {
    return NextResponse.json(
      { error: "fetch_failed", message: err instanceof Error ? err.message : "unknown" },
      { status: 502 },
    )
  }
}
