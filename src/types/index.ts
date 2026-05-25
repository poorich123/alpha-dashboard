// Trading strategy — how to manage this position
// - "dca":  Long-term DCA at Fibonacci retracement levels (38.2 / 50 / 61.8)
// - "swing": Short-term swing trade at Pivot Point S/R
// - "spec":  High-risk speculative momentum (no fixed entry rules)
// Optional — falls back to inferring from category if not set.
export type TradingStrategy = "dca" | "swing" | "spec"

export interface Position {
  id: string
  ticker: string
  companyName: string
  logoUrl: string
  category: "core" | "defensive" | "satellite" | "speculative" | "etf" | "watchlist"
  strategy?: TradingStrategy  // optional; defaults inferred from category
  shares: number
  avgCost: number
  currentPrice: number
  targetPrice: number
  stopLoss: number
  currency: "USD"
  exchange: "NASDAQ" | "NYSE" | "OTC" | string
  sector: string
  thesis: string
  entryDate: string
  tags: string[]
  notes: string
  isActive: boolean
  alertEnabled: boolean
  high52w?: number
  low52w?: number
  peRatio?: number
  marketCap?: number
}

// Infer default strategy from category when Position.strategy is not set
export function inferStrategy(category: Position["category"]): TradingStrategy {
  if (category === "speculative") return "spec"
  if (category === "satellite") return "swing"
  return "dca"  // core, defensive, etf → long-term DCA default
}

export interface WatchlistItem {
  id: string
  ticker: string
  companyName: string
  logoUrl: string
  entryZoneLow: number
  entryZoneHigh: number
  targetPrice: number
  stopLoss: number
  thesis: string
  priority: "high" | "medium" | "low"
  notes: string
  addedDate: string
  sector: string
  currentPrice?: number
  daysToEarnings?: number
}

export interface PortfolioSettings {
  totalCashUSD: number
  totalCashTHB: number
  baseCurrency: "USD" | "THB"
  riskTolerance: 1 | 2 | 3 | 4 | 5
  targetAllocation: {
    core: number
    defensive: number
    satellite: number
    speculative: number
    etf: number
    cash: number
  }
  categories: CategoryConfig[]
  monthlyContribution: number
  portfolioName: string
  ownerName: string
  startingCapital: number
  inceptionDate: string
  finnhubApiKey: string
  anthropicApiKey: string
  exchangeRateApiKey: string
  refreshInterval: 1 | 5 | 15
  darkMode: boolean
  showTHB: boolean
  alertStopLoss: boolean
  alertEarnings: boolean
  alertPriceTarget: boolean
  dailyBriefTime: string
}

export interface CategoryConfig {
  id: string
  name: string
  emoji: string
  maxPositionSize: number
  maxCategorySize: number
  color: string
}

export interface PortfolioSnapshot {
  date: string
  totalValue: number
  cashUSD: number
  sp500: number
  nasdaq: number
}

export interface Trade {
  id: string
  ticker: string
  action: "buy" | "sell"
  shares: number
  price: number
  date: string
  notes: string
  realizedPnL?: number
}

export interface Quote {
  c: number   // current price
  d: number   // change
  dp: number  // percent change
  h: number   // high
  l: number   // low
  o: number   // open
  pc: number  // previous close
  v?: number  // volume
}

export interface Candle {
  o: number[]
  h: number[]
  l: number[]
  c: number[]
  v: number[]
  t: number[]
  s: string
}

export interface CompanyProfile {
  name: string
  ticker: string
  logo: string
  exchange: string
  finnhubIndustry: string
  marketCapitalization: number
  shareOutstanding: number
  currency: string
  country: string
  weburl: string
}

export interface NewsItem {
  id: number
  category: string
  datetime: number
  headline: string
  image: string
  related: string
  source: string
  summary: string
  url: string
}

export interface EarningsCalendarItem {
  date: string
  epsActual: number | null
  epsEstimate: number | null
  hour: string
  quarter: number
  revenueActual: number | null
  revenueEstimate: number | null
  symbol: string
  year: number
}

export interface EconomicEvent {
  actual: number | null
  estimate: number | null
  event: string
  impact: string
  prev: number | null
  time: string
  unit: string
  country: string
}

export interface TechnicalAnalysis {
  rsi: number
  ema20: number
  ema50: number
  ema100: number
  ema200: number
  macd: number
  macdSignal: number
  macdHistogram: number
  bbUpper: number
  bbMiddle: number
  bbLower: number
  aboveEma50: boolean
  aboveEma200: boolean
  trend: "uptrend" | "downtrend" | "sideways"
  signal: "STRONG BUY" | "BUY" | "NEUTRAL" | "SELL" | "STRONG SELL"
  support1: number
  support2: number
  resistance1: number
  resistance2: number
}

export interface PortfolioStats {
  totalValue: number
  totalCost: number
  totalPnL: number
  totalPnLPercent: number
  todayPnL: number
  todayPnLPercent: number
  cashUSD: number
  cashTHB: number
  usdThbRate: number
  totalValueTHB: number
  positions: Position[]
  allocation: Record<string, number>
  sectorAllocation: Record<string, number>
  alphaScore: number
}

export interface AlphaScore {
  total: number
  quality: number
  momentum: number
  diversification: number
  riskManagement: number
  catalyst: number
  valuation: number
  thesisAlignment: number
  badge: string
  strengths: string[]
  improvements: string[]
  urgentAction: string | null
}

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: number
}
