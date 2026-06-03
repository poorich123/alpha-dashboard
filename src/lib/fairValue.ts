/**
 * Fair Value / Intrinsic Value Engine
 * ─────────────────────────────────────
 * Three independent valuation methods + a blended estimate and margin of safety.
 *
 *   1. DCF (Discounted Cash Flow) — project FCF 10y, discount at CAPM rate,
 *      Gordon terminal value. The primary method for cash-generative companies.
 *   2. Comparable (relative) — forward EPS × a growth-justified P/E (PEG≈1.5).
 *   3. Asset-based — book value per share + Graham Number √(22.5·EPS·BVPS).
 *
 * Inputs come from /api/fundamentals (Yahoo quoteSummary). Every method degrades
 * gracefully: if the data isn't there (negative FCF, ETF, no earnings) it returns
 * `available:false` with a caveat instead of throwing.
 *
 * NOT investment advice — valuation is assumption-sensitive. The assumptions are
 * surfaced explicitly so the user can judge them.
 */

// ─── Raw fundamentals (shape returned by /api/fundamentals) ────────────────────

export interface FundamentalsRaw {
  ticker: string
  asOf: number
  longName: string
  currency: string
  quoteType: string              // EQUITY | ETF | MUTUALFUND | ...

  currentPrice: number | null
  targetMeanPrice: number | null

  freeCashflow: number | null
  fcfHistory: number[]           // newest first
  operatingCashflow: number | null
  totalRevenue: number | null
  revenueGrowth: number | null   // fraction (0.12 = 12%)
  earningsGrowth: number | null
  longTermGrowth: number | null  // analyst +5y, fraction
  nextYearGrowth: number | null
  returnOnEquity: number | null

  sharesOutstanding: number | null
  beta: number | null
  forwardEps: number | null
  trailingEps: number | null
  bookValuePerShare: number | null
  enterpriseValue: number | null
  pegRatio: number | null

  trailingPE: number | null
  forwardPE: number | null
  marketCap: number | null
  dividendYield: number | null

  totalCash: number | null
  totalDebt: number | null
  netDebt: number | null         // totalDebt − totalCash

  totalAssets: number | null
  totalLiabilities: number | null
  totalStockholderEquity: number | null
  netIncome: number | null
}

// ─── Result types ──────────────────────────────────────────────────────────────

export type ValuationMethod = "DCF" | "Comparable" | "EV/Sales" | "Asset" | "Analyst"

export interface MethodValuation {
  method: ValuationMethod
  available: boolean
  valuePerShare: number | null
  weight: number               // 0-1 (renormalized share in the blend)
  assumptions: string[]
  caveat?: string
}

export type MoSLabel = "Deep Value" | "Undervalued" | "Fair Value" | "Overvalued" | "Expensive"

export interface FairValueResult {
  ticker: string
  longName: string
  currentPrice: number | null
  available: boolean             // false for ETF / insufficient data
  unavailableReason?: string

  methods: MethodValuation[]
  fairValueBase: number | null
  fairValueLow: number | null
  fairValueHigh: number | null

  marginOfSafety: number | null  // (base − price) / base, fraction
  mosLabel: MoSLabel | null
  mosColor: string               // tailwind text color class
  analystTarget: number | null

  notes: string[]
}

// ─── Constants (assumptions) ───────────────────────────────────────────────────

const RISK_FREE = 0.043          // ~10y UST
const EQUITY_RISK_PREMIUM = 0.05
const TERMINAL_GROWTH = 0.025
const HIGH_GROWTH_YEARS = 5
const FADE_YEARS = 5             // years 6-10 fade g → terminal

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const pct = (f: number) => `${(f * 100).toFixed(1)}%`

// ─── Client fetch (mirrors fetchHoldings in institutionalHoldings.ts) ──────────

export async function fetchFundamentals(ticker: string): Promise<FundamentalsRaw> {
  const res = await fetch(
    `/api/fundamentals?symbol=${encodeURIComponent(ticker)}&_t=${Date.now()}`,
    { cache: "no-store" },
  )
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "unknown" }))
    throw new Error(body.error || body.message || `HTTP ${res.status}`)
  }
  return await res.json() as FundamentalsRaw
}

// ─── Growth + discount helpers ─────────────────────────────────────────────────

function pickGrowth(f: FundamentalsRaw): number {
  // Prefer forward-looking estimates (analyst long-term, then next-year) before
  // trailing earnings/revenue growth — a backlog/turnaround stock can have
  // negative trailing growth but large forward growth. Falls back to a default.
  const g = f.longTermGrowth ?? f.nextYearGrowth ?? f.earningsGrowth ?? f.revenueGrowth ?? 0.05
  return clamp(g, 0, 0.18)        // never project >18% for a decade
}

function discountRate(f: FundamentalsRaw): number {
  const beta = f.beta ?? 1.1
  return clamp(RISK_FREE + beta * EQUITY_RISK_PREMIUM, 0.075, 0.12)
}

// ─── DCF ────────────────────────────────────────────────────────────────────────

function dcfValuePerShare(fcf: number, g: number, r: number, netDebt: number, shares: number): number {
  let pvSum = 0
  let projected = fcf
  let lastProjected = fcf
  for (let year = 1; year <= HIGH_GROWTH_YEARS + FADE_YEARS; year++) {
    // years 1-5 grow at g; years 6-10 fade linearly toward terminal growth
    let growth: number
    if (year <= HIGH_GROWTH_YEARS) {
      growth = g
    } else {
      const step = (g - TERMINAL_GROWTH) * (year - HIGH_GROWTH_YEARS) / FADE_YEARS
      growth = g - step
    }
    projected = projected * (1 + growth)
    pvSum += projected / Math.pow(1 + r, year)
    lastProjected = projected
  }
  // Gordon terminal value on the last projected FCF, discounted back
  const terminalValue = (lastProjected * (1 + TERMINAL_GROWTH)) / (r - TERMINAL_GROWTH)
  pvSum += terminalValue / Math.pow(1 + r, HIGH_GROWTH_YEARS + FADE_YEARS)

  const equityValue = pvSum - netDebt   // FCFF → subtract net debt for equity
  return equityValue / shares
}

export function computeDCF(f: FundamentalsRaw): MethodValuation & { low?: number; high?: number } {
  const fcf = f.freeCashflow
  const shares = f.sharesOutstanding
  const base: MethodValuation & { low?: number; high?: number } = {
    method: "DCF", available: false, valuePerShare: null, weight: 0, assumptions: [],
  }

  if (fcf == null || shares == null || shares <= 0) {
    base.caveat = "ไม่มีข้อมูล FCF หรือจำนวนหุ้น — ข้าม DCF"
    return base
  }
  if (fcf <= 0) {
    base.caveat = "FCF ติดลบ — DCF ไม่น่าเชื่อถือสำหรับบริษัทที่ยังไม่สร้างกระแสเงินสด"
    return base
  }

  const g = pickGrowth(f)
  const r = discountRate(f)
  const netDebt = f.netDebt ?? 0

  const value = dcfValuePerShare(fcf, g, r, netDebt, shares)
  // Sensitivity band: bear = lower growth + higher discount; bull = the reverse
  const low = dcfValuePerShare(fcf, clamp(g - 0.03, 0, 0.18), clamp(r + 0.01, 0.075, 0.13), netDebt, shares)
  const high = dcfValuePerShare(fcf, clamp(g + 0.03, 0, 0.20), clamp(r - 0.01, 0.07, 0.12), netDebt, shares)

  if (!Number.isFinite(value) || value <= 0) {
    base.caveat = "ผล DCF ไม่สมเหตุผล (อาจเพราะ net debt สูงมาก) — ข้าม"
    return base
  }

  return {
    method: "DCF",
    available: true,
    valuePerShare: value,
    weight: 0,
    low: Math.min(low, high),
    high: Math.max(low, high),
    assumptions: [
      `FCF ฐาน $${(fcf / 1e9).toFixed(2)}B`,
      `Growth ${pct(g)}/ปี (5 ปีแรก) → fade เป็น ${pct(TERMINAL_GROWTH)}`,
      `Discount ${pct(r)} (CAPM, β=${(f.beta ?? 1.1).toFixed(2)})`,
      f.netDebt != null ? `Net debt $${(f.netDebt / 1e9).toFixed(2)}B` : "Net debt n/a (ใช้ 0)",
    ],
  }
}

// ─── Comparable (relative) ──────────────────────────────────────────────────────

export function computeComparable(f: FundamentalsRaw): MethodValuation {
  const eps = (f.forwardEps && f.forwardEps > 0) ? f.forwardEps : f.trailingEps
  const base: MethodValuation = {
    method: "Comparable", available: false, valuePerShare: null, weight: 0, assumptions: [],
  }
  if (eps == null || eps <= 0) {
    base.caveat = "EPS ติดลบ/ไม่มี — เทียบ P/E ไม่ได้"
    return base
  }

  // Prefer forward growth so backlog/turnaround names aren't penalized by a
  // negative trailing number (e.g. CIFR: trailing −29% but next-year +311%).
  const g = f.longTermGrowth ?? f.nextYearGrowth ?? f.earningsGrowth ?? f.revenueGrowth ?? 0.08
  const rawGrowthPct = g * 100
  const growthPct = clamp(rawGrowthPct, 0, 30)
  // Market-realistic fair P/E: ~11× base for a no-growth profitable company,
  // rising ~1.1× per point of growth, capped 10–38× (mirrors how the market
  // actually pays up for growth — a flat PEG×1.5 floored at 8 was too punitive
  // for quality compounders like KO).
  const fairPE = clamp(11 + growthPct * 1.1, 10, 38)
  const value = eps * fairPE
  const usedEps = (f.forwardEps && f.forwardEps > 0) ? "forward" : "trailing"
  const capped = rawGrowthPct > 30

  return {
    method: "Comparable",
    available: true,
    valuePerShare: value,
    weight: 0,
    assumptions: [
      `${usedEps} EPS $${eps.toFixed(2)}`,
      `Fair P/E ${fairPE.toFixed(0)}× (base 11× + growth ${growthPct.toFixed(0)}%${capped ? ` · cap จาก ${rawGrowthPct.toFixed(0)}%` : ""})`,
      f.forwardPE != null ? `เทียบ forward P/E ปัจจุบัน ${f.forwardPE.toFixed(1)}×` : "",
    ].filter(Boolean),
  }
}

// ─── Asset-based ─────────────────────────────────────────────────────────────────

export function computeAsset(f: FundamentalsRaw): MethodValuation {
  const bvps = f.bookValuePerShare
  const eps = f.trailingEps
  const base: MethodValuation = {
    method: "Asset", available: false, valuePerShare: null, weight: 0, assumptions: [],
  }
  if (bvps == null || bvps <= 0) {
    base.caveat = "Book value ติดลบ/ไม่มี — ตีมูลค่าจากสินทรัพย์ไม่ได้"
    return base
  }

  // Graham Number when earnings are positive; otherwise fall back to plain book value.
  let value: number
  const assumptions: string[] = [`Book value/share $${bvps.toFixed(2)}`]
  if (eps != null && eps > 0) {
    value = Math.sqrt(22.5 * eps * bvps)
    assumptions.push(`Graham Number √(22.5 × EPS $${eps.toFixed(2)} × BVPS) = $${value.toFixed(2)}`)
  } else {
    value = bvps
    assumptions.push("EPS ติดลบ → ใช้ book value เป็นพื้น (ไม่มี Graham Number)")
  }

  return { method: "Asset", available: true, valuePerShare: value, weight: 0, assumptions }
}

// ─── EV/Sales (revenue multiple) ─────────────────────────────────────────────────
// The method Wall Street uses for high-growth / not-yet-profitable companies,
// where P/E and DCF break down. Fair EV = revenue × a growth-scaled P/S multiple,
// then subtract net debt for equity value.

export function computeEvSales(f: FundamentalsRaw): MethodValuation {
  const rev = f.totalRevenue
  const shares = f.sharesOutstanding
  const base: MethodValuation = {
    method: "EV/Sales", available: false, valuePerShare: null, weight: 0, assumptions: [],
  }
  if (rev == null || rev <= 0 || shares == null || shares <= 0) {
    base.caveat = "ไม่มีรายได้/จำนวนหุ้น — ข้าม EV/Sales"
    return base
  }

  const g = f.longTermGrowth ?? f.nextYearGrowth ?? f.earningsGrowth ?? f.revenueGrowth ?? 0.05
  const growthPct = clamp(g * 100, 0, 40)
  const ps = clamp(1 + growthPct * 0.30, 1, 12)   // ~1× at flat, ~12× at hyper-growth
  const netDebt = f.netDebt ?? 0
  const value = (rev * ps - netDebt) / shares

  if (!Number.isFinite(value) || value <= 0) {
    base.caveat = "ผล EV/Sales ไม่สมเหตุผล (net debt สูงมาก) — ข้าม"
    return base
  }

  return {
    method: "EV/Sales",
    available: true,
    valuePerShare: value,
    weight: 0,
    assumptions: [
      `Revenue $${(rev / 1e9).toFixed(2)}B`,
      `P/S ${ps.toFixed(1)}× (growth-scaled ${growthPct.toFixed(0)}%)`,
      f.netDebt != null ? `หัก net debt $${(f.netDebt / 1e9).toFixed(2)}B` : "",
    ].filter(Boolean),
  }
}

// ─── Analyst consensus (Wall Street target) ──────────────────────────────────────

export function computeAnalystTarget(f: FundamentalsRaw): MethodValuation {
  const t = f.targetMeanPrice
  if (t == null || t <= 0) {
    return { method: "Analyst", available: false, valuePerShare: null, weight: 0, assumptions: [], caveat: "ไม่มีเป้านักวิเคราะห์" }
  }
  return {
    method: "Analyst",
    available: true,
    valuePerShare: t,
    weight: 0,
    assumptions: ["เป้าเฉลี่ยนักวิเคราะห์ (Wall St consensus, 12 เดือน)"],
  }
}

// ─── Margin of safety label ──────────────────────────────────────────────────────

function mosLabel(mos: number): { label: MoSLabel; color: string } {
  if (mos >= 0.30)  return { label: "Deep Value",  color: "text-emerald-400" }
  if (mos >= 0.10)  return { label: "Undervalued", color: "text-green-400" }
  if (mos >= -0.10) return { label: "Fair Value",  color: "text-yellow-400" }
  if (mos >= -0.25) return { label: "Overvalued",  color: "text-orange-400" }
  return { label: "Expensive", color: "text-red-400" }
}

// ─── Blend + main entry ──────────────────────────────────────────────────────────

// Blend weights ≈ how a sell-side analyst weighs methods. Analyst consensus +
// DCF + multiples carry most of it; book value is a minor floor. Renormalized
// over whatever methods have data for a given stock.
const BASE_WEIGHTS: Record<ValuationMethod, number> = {
  DCF: 0.25, Comparable: 0.20, "EV/Sales": 0.12, Analyst: 0.35, Asset: 0.08,
}

export function computeFairValue(f: FundamentalsRaw): FairValueResult {
  const price = f.currentPrice
  const result: FairValueResult = {
    ticker: f.ticker,
    longName: f.longName,
    currentPrice: price,
    available: false,
    methods: [],
    fairValueBase: null,
    fairValueLow: null,
    fairValueHigh: null,
    marginOfSafety: null,
    mosLabel: null,
    mosColor: "text-gray-400",
    analystTarget: f.targetMeanPrice,
    notes: [],
  }

  // ETFs / funds have no per-share intrinsic value in this framework.
  if (f.quoteType && f.quoteType !== "EQUITY") {
    result.unavailableReason = `${f.quoteType} — โมเดลนี้ใช้กับหุ้นรายตัวเท่านั้น`
    return result
  }

  const dcf = computeDCF(f)
  const comp = computeComparable(f)
  const evs = computeEvSales(f)
  const asset = computeAsset(f)
  const analyst = computeAnalystTarget(f)
  const methods: MethodValuation[] = [
    { method: dcf.method, available: dcf.available, valuePerShare: dcf.valuePerShare, weight: 0, assumptions: dcf.assumptions, caveat: dcf.caveat },
    comp,
    evs,
    asset,
    analyst,
  ]

  const avail = methods.filter(m => m.available && m.valuePerShare != null)
  if (avail.length === 0) {
    result.methods = methods
    result.unavailableReason = "ข้อมูลพื้นฐานไม่พอสำหรับทุกวิธี (อาจเป็นหุ้นใหม่/ขาดงบ)"
    return result
  }

  // Per-stock weights. For loss-making companies the Asset method is just plain
  // book value (a weak signal for a growth/backlog story) so halve its weight.
  const weights: Record<ValuationMethod, number> = {
    DCF: BASE_WEIGHTS.DCF,
    Comparable: BASE_WEIGHTS.Comparable,
    "EV/Sales": BASE_WEIGHTS["EV/Sales"],
    Analyst: BASE_WEIGHTS.Analyst,
    Asset: (f.trailingEps != null && f.trailingEps <= 0) ? BASE_WEIGHTS.Asset / 2 : BASE_WEIGHTS.Asset,
  }

  // Renormalize weights over the methods that are actually available.
  const totalW = avail.reduce((s, m) => s + weights[m.method], 0)
  for (const m of methods) {
    m.weight = m.available && m.valuePerShare != null ? weights[m.method] / totalW : 0
  }

  const base = avail.reduce((s, m) => s + (m.valuePerShare as number) * (weights[m.method] / totalW), 0)

  // Range = the spread of the methods themselves (shows how much they disagree),
  // widened slightly by the DCF sensitivity band when present.
  const vals = avail.map(m => m.valuePerShare as number)
  let low = Math.min(...vals)
  let high = Math.max(...vals)
  if (dcf.available && dcf.low && dcf.high) {
    low = Math.min(low, dcf.low)
    high = Math.max(high, dcf.high)
  }

  result.available = true
  result.methods = methods
  result.fairValueBase = base
  result.fairValueLow = Math.min(low, base)
  result.fairValueHigh = Math.max(high, base)

  if (price != null && price > 0 && base > 0) {
    const mos = (base - price) / base
    const { label, color } = mosLabel(mos)
    result.marginOfSafety = mos
    result.mosLabel = label
    result.mosColor = color
  }

  result.notes.push(`ใช้ ${avail.length}/${methods.length} วิธี (${avail.map(m => m.method).join(" · ")})`)

  // Speculative / growth / turnaround stocks: fundamental models systematically
  // under-value them because current earnings/cash flow are depressed or negative.
  // Flag this so a huge "Expensive" gap isn't mistaken for a precise target.
  const negEarnings = f.trailingEps != null && f.trailingEps < 0
  const negFcf = f.freeCashflow != null && f.freeCashflow < 0
  const shrinking = f.revenueGrowth != null && f.revenueGrowth < 0
  if (negEarnings || negFcf || shrinking) {
    const tags = [
      negEarnings ? "ขาดทุน (EPS ติดลบ)" : "",
      negFcf ? "FCF ติดลบ" : "",
      shrinking ? `รายได้หด ${(f.revenueGrowth! * 100).toFixed(0)}%` : "",
    ].filter(Boolean).join(" · ")
    result.notes.push(`⚠️ หุ้น growth/turnaround (${tags}) — มูลค่าพึ่ง EV/Sales + เป้านักวิเคราะห์มากขึ้น (DCF/P-E ใช้ไม่ได้กับหุ้นที่ยังไม่กำไร) · ใช้เป็นกรอบ ไม่ใช่ราคาเป้าตายตัว`)
  }

  return result
}
