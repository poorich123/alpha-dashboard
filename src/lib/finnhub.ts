import type { Quote, Candle, CompanyProfile, NewsItem, EarningsCalendarItem, EconomicEvent } from "@/types"

const BASE_URL = "https://finnhub.io/api/v1"

function getApiKey(): string {
  // Try localStorage settings first (set via Settings page)
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("alpha_settings")
      if (raw) {
        const s = JSON.parse(raw)
        if (s.finnhubApiKey && s.finnhubApiKey.length > 5) return s.finnhubApiKey
      }
    } catch {}
  }
  return process.env.NEXT_PUBLIC_FINNHUB_API_KEY || ""
}

const cache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data as T
  }
  return null
}

function setCached(key: string, data: unknown): void {
  cache.set(key, { data, timestamp: Date.now() })
}

async function finnhubFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const key = endpoint + JSON.stringify(params)
  const cached = getCached<T>(key)
  if (cached) return cached

  const apiKey = getApiKey()
  if (!apiKey || apiKey === "your_finnhub_key_here") {
    throw new Error("Finnhub API key not configured")
  }

  const url = new URL(`${BASE_URL}${endpoint}`)
  url.searchParams.set("token", apiKey)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Finnhub API error: ${res.status}`)
  const data = await res.json()
  setCached(key, data)
  return data
}

export async function getQuote(symbol: string): Promise<Quote> {
  return finnhubFetch<Quote>("/quote", { symbol: symbol.toUpperCase() })
}

export async function getCandles(
  symbol: string,
  resolution: string,
  from: number,
  to: number
): Promise<Candle> {
  return finnhubFetch<Candle>("/stock/candle", {
    symbol: symbol.toUpperCase(),
    resolution,
    from: String(from),
    to: String(to),
  })
}

export async function getCompanyProfile(symbol: string): Promise<CompanyProfile> {
  return finnhubFetch<CompanyProfile>("/stock/profile2", { symbol: symbol.toUpperCase() })
}

export async function getNews(symbol: string): Promise<NewsItem[]> {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 7)
  const fmt = (d: Date) => d.toISOString().split("T")[0]
  return finnhubFetch<NewsItem[]>("/company-news", {
    symbol: symbol.toUpperCase(),
    from: fmt(from),
    to: fmt(to),
  })
}

export async function getMarketNews(): Promise<NewsItem[]> {
  return finnhubFetch<NewsItem[]>("/news", { category: "general" })
}

export async function getEarnings(symbol: string): Promise<EarningsCalendarItem[]> {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 365)
  to.setDate(to.getDate() + 90)
  const fmt = (d: Date) => d.toISOString().split("T")[0]
  const res = await finnhubFetch<{ earningsCalendar: EarningsCalendarItem[] }>(
    "/calendar/earnings",
    { symbol: symbol.toUpperCase(), from: fmt(from), to: fmt(to) }
  )
  return res.earningsCalendar || []
}

export async function getEarningsCalendar(from: string, to: string): Promise<EarningsCalendarItem[]> {
  const res = await finnhubFetch<{ earningsCalendar: EarningsCalendarItem[] }>(
    "/calendar/earnings",
    { from, to }
  )
  return res.earningsCalendar || []
}

export async function getEconomicCalendar(): Promise<EconomicEvent[]> {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 7)
  to.setDate(to.getDate() + 30)
  const fmt = (d: Date) => d.toISOString().split("T")[0]
  const res = await finnhubFetch<{ economicCalendar: EconomicEvent[] }>(
    "/calendar/economic",
    { from: fmt(from), to: fmt(to) }
  )
  return res.economicCalendar || []
}

export async function getMultipleQuotes(symbols: string[]): Promise<Record<string, Quote>> {
  const results: Record<string, Quote> = {}
  const batchSize = 10
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize)
    await Promise.all(
      batch.map(async (sym) => {
        try {
          results[sym] = await getQuote(sym)
        } catch {
          // skip failed
        }
      })
    )
    if (i + batchSize < symbols.length) {
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  return results
}

function getExchangeRateKey(): string {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("alpha_settings")
      if (raw) {
        const s = JSON.parse(raw)
        if (s.exchangeRateApiKey && s.exchangeRateApiKey.length > 5) return s.exchangeRateApiKey
      }
    } catch {}
  }
  return process.env.NEXT_PUBLIC_EXCHANGE_RATE_API_KEY || ""
}

export async function getUsdThbRate(): Promise<number> {
  const key = getExchangeRateKey()
  if (!key || key === "your_exchangerate_key_here") {
    return 35.5 // fallback rate
  }
  const cached = getCached<number>("usd_thb")
  if (cached) return cached

  try {
    const res = await fetch(`https://v6.exchangerate-api.com/v6/${key}/latest/USD`)
    const data = await res.json()
    const rate = data.conversion_rates?.THB || 35.5
    setCached("usd_thb", rate)
    return rate
  } catch {
    return 35.5
  }
}

export function clearCache(): void {
  cache.clear()
}
