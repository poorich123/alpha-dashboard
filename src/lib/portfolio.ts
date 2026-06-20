import type {
  Position,
  WatchlistItem,
  PortfolioSettings,
  PortfolioSnapshot,
  Trade,
  PortfolioStats,
} from "@/types"

const KEYS = {
  positions: "alpha_positions",
  watchlist: "alpha_watchlist",
  settings: "alpha_settings",
  snapshots: "alpha_snapshots",
  trades: "alpha_trades",
  onboarded: "alpha_onboarded",
}

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function save(key: string, data: unknown): void {
  if (typeof window === "undefined") return
  localStorage.setItem(key, JSON.stringify(data))
}

export function getPositions(): Position[] {
  return load<Position[]>(KEYS.positions, [])
}

export function savePositions(positions: Position[]): void {
  save(KEYS.positions, positions)
}

export function addPosition(position: Position): void {
  const positions = getPositions()
  positions.push(position)
  savePositions(positions)
}

export function updatePosition(id: string, updates: Partial<Position>): void {
  const positions = getPositions()
  const idx = positions.findIndex((p) => p.id === id)
  if (idx !== -1) {
    positions[idx] = { ...positions[idx], ...updates }
    savePositions(positions)
  }
}

export function deletePosition(id: string): void {
  const positions = getPositions().filter((p) => p.id !== id)
  savePositions(positions)
}

export function getWatchlist(): WatchlistItem[] {
  return load<WatchlistItem[]>(KEYS.watchlist, [])
}

export function saveWatchlist(items: WatchlistItem[]): void {
  save(KEYS.watchlist, items)
}

export function addWatchlistItem(item: WatchlistItem): void {
  const items = getWatchlist()
  items.push(item)
  saveWatchlist(items)
}

export function updateWatchlistItem(id: string, updates: Partial<WatchlistItem>): void {
  const items = getWatchlist()
  const idx = items.findIndex((i) => i.id === id)
  if (idx !== -1) {
    items[idx] = { ...items[idx], ...updates }
    saveWatchlist(items)
  }
}

export function deleteWatchlistItem(id: string): void {
  saveWatchlist(getWatchlist().filter((i) => i.id !== id))
}

export const DEFAULT_SETTINGS: PortfolioSettings = {
  totalCashUSD: 10000,
  totalCashTHB: 0,
  baseCurrency: "USD",
  riskTolerance: 3,
  targetAllocation: {
    core: 40,
    defensive: 15,
    satellite: 20,
    speculative: 10,
    etf: 10,
    cash: 5,
  },
  categories: [
    { id: "core", name: "Core", emoji: "💎", maxPositionSize: 15, maxCategorySize: 50, color: "#00C2D4" },
    { id: "defensive", name: "Defensive", emoji: "🛡️", maxPositionSize: 10, maxCategorySize: 25, color: "#22c55e" },
    { id: "satellite", name: "Satellite", emoji: "🛸", maxPositionSize: 10, maxCategorySize: 30, color: "#3b82f6" },
    { id: "speculative", name: "Speculative", emoji: "🎯", maxPositionSize: 5, maxCategorySize: 15, color: "#f59e0b" },
    { id: "etf", name: "ETFs", emoji: "💰", maxPositionSize: 15, maxCategorySize: 25, color: "#06b6d4" },
    { id: "watchlist", name: "Watchlist", emoji: "👀", maxPositionSize: 0, maxCategorySize: 0, color: "#9ca3af" },
  ],
  monthlyContribution: 1000,
  portfolioName: "Alpha Portfolio",
  ownerName: "Investor",
  startingCapital: 100000,
  inceptionDate: new Date().toISOString().split("T")[0],
  finnhubApiKey: "",
  anthropicApiKey: "",
  exchangeRateApiKey: "",
  refreshInterval: 5,
  darkMode: true,
  showTHB: true,
  alertStopLoss: true,
  alertEarnings: true,
  alertPriceTarget: true,
  dailyBriefTime: "09:00",
}

export function getSettings(): PortfolioSettings {
  return { ...DEFAULT_SETTINGS, ...load<Partial<PortfolioSettings>>(KEYS.settings, {}) }
}

export function saveSettings(settings: PortfolioSettings): void {
  save(KEYS.settings, settings)
}

export function getSnapshots(): PortfolioSnapshot[] {
  return load<PortfolioSnapshot[]>(KEYS.snapshots, [])
}

export function addSnapshot(snapshot: PortfolioSnapshot): void {
  const snapshots = getSnapshots()
  const existing = snapshots.findIndex((s) => s.date === snapshot.date)
  if (existing !== -1) snapshots[existing] = snapshot
  else snapshots.push(snapshot)
  if (snapshots.length > 365) snapshots.splice(0, snapshots.length - 365)
  save(KEYS.snapshots, snapshots)
}

export function getTrades(): Trade[] {
  return load<Trade[]>(KEYS.trades, [])
}

export function addTrade(trade: Trade): void {
  const trades = getTrades()
  trades.push(trade)
  save(KEYS.trades, trades)
}

export function updateTrade(id: string, patch: Partial<Trade>): void {
  const trades = getTrades().map(t => (t.id === id ? { ...t, ...patch } : t))
  save(KEYS.trades, trades)
}

export function deleteTrade(id: string): void {
  save(KEYS.trades, getTrades().filter(t => t.id !== id))
}

export function isOnboarded(): boolean {
  return load<boolean>(KEYS.onboarded, false)
}

export function setOnboarded(): void {
  save(KEYS.onboarded, true)
}

export function calculatePnL(
  position: Position,
  currentPrice?: number
): { unrealizedPnL: number; unrealizedPnLPercent: number; totalValue: number } {
  const price = currentPrice || position.currentPrice
  const totalValue = position.shares * price
  const totalCost = position.shares * position.avgCost
  const unrealizedPnL = totalValue - totalCost
  const unrealizedPnLPercent = totalCost > 0 ? (unrealizedPnL / totalCost) * 100 : 0
  return { unrealizedPnL, unrealizedPnLPercent, totalValue }
}

// Alpha Score — 4 weighted dimensions (0-25 each, total 0-100)
function computeAlphaScore(m: {
  positionCount: number
  totalPnLPercent: number
  sectorCount: number
  winRate: number       // 0..1
  cashWeight: number    // 0..100 (% of portfolio in cash)
}): number {
  // 1. Diversification (positions count): peak at 12-18
  const diversification = m.positionCount === 0 ? 0
    : m.positionCount >= 10 && m.positionCount <= 20 ? 25
    : m.positionCount >= 5 ? 18
    : m.positionCount >= 3 ? 12
    : 6

  // 2. Performance (total return %): scale around 0..15%
  const performance = m.totalPnLPercent >= 15 ? 25
    : m.totalPnLPercent >= 5 ? 20
    : m.totalPnLPercent >= 0 ? 15
    : m.totalPnLPercent >= -5 ? 8
    : 2

  // 3. Sector diversity: 5+ sectors = ideal
  const sectors = m.sectorCount >= 5 ? 25
    : m.sectorCount >= 3 ? 18
    : m.sectorCount >= 2 ? 12
    : m.sectorCount >= 1 ? 6
    : 0

  // 4. Risk control: blend of win rate + cash buffer (5-25% cash ideal)
  const goodCash = m.cashWeight >= 5 && m.cashWeight <= 25
  const winScore = m.winRate >= 0.7 ? 15 : m.winRate >= 0.5 ? 12 : m.winRate >= 0.4 ? 8 : 4
  const cashScore = goodCash ? 10 : m.cashWeight > 50 ? 4 : 6
  const risk = Math.min(25, winScore + cashScore)

  return Math.round(diversification + performance + sectors + risk)
}

export function calculatePortfolioStats(
  positions: Position[],
  cashUSD: number,
  usdThbRate: number
): PortfolioStats {
  const activePositions = positions.filter((p) => p.isActive && p.category !== "watchlist")

  let totalValue = cashUSD
  let totalCost = 0
  let todayPnL = 0

  for (const p of activePositions) {
    const { totalValue: posValue } = calculatePnL(p)
    totalValue += posValue
    totalCost += p.shares * p.avgCost
    todayPnL += p.shares * (p.currentPrice - (p.currentPrice / (1 + (p as unknown as { dp?: number }).dp! / 100 || 1)))
  }

  const totalPnL = totalValue - cashUSD - totalCost
  const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0
  const todayPnLPercent = (totalValue - todayPnL) > 0 ? (todayPnL / (totalValue - todayPnL)) * 100 : 0

  const allocation: Record<string, number> = {}
  const sectorAllocation: Record<string, number> = {}

  for (const p of activePositions) {
    const { totalValue: posValue } = calculatePnL(p)
    const weight = totalValue > 0 ? (posValue / totalValue) * 100 : 0
    allocation[p.category] = (allocation[p.category] || 0) + weight
    if (p.sector) {
      sectorAllocation[p.sector] = (sectorAllocation[p.sector] || 0) + weight
    }
  }

  const cashWeight = totalValue > 0 ? (cashUSD / totalValue) * 100 : 100
  allocation["cash"] = cashWeight

  // ── Compute Alpha Score (0-100) from real portfolio metrics ────────────
  // 4 dimensions × 25 points each = 100 max
  const alphaScore = computeAlphaScore({
    positionCount: activePositions.length,
    totalPnLPercent,
    sectorCount: Object.keys(sectorAllocation).length,
    winRate: activePositions.length > 0
      ? activePositions.filter(p => {
          const { unrealizedPnLPercent } = calculatePnL(p)
          return unrealizedPnLPercent > 0
        }).length / activePositions.length
      : 0,
    cashWeight,
  })

  return {
    totalValue,
    totalCost,
    totalPnL,
    totalPnLPercent,
    todayPnL,
    todayPnLPercent,
    cashUSD,
    cashTHB: cashUSD * usdThbRate,
    usdThbRate,
    totalValueTHB: totalValue * usdThbRate,
    positions: activePositions,
    allocation,
    sectorAllocation,
    alphaScore,
  }
}

export function exportPortfolio(): string {
  return JSON.stringify(
    {
      positions: getPositions(),
      watchlist: getWatchlist(),
      settings: getSettings(),
      trades: getTrades(),
      exportDate: new Date().toISOString(),
    },
    null,
    2
  )
}

export function importPortfolio(json: string): void {
  const data = JSON.parse(json)
  if (data.positions) savePositions(data.positions)
  if (data.watchlist) saveWatchlist(data.watchlist)
  if (data.settings) saveSettings(data.settings)
  if (data.trades) save(KEYS.trades, data.trades)
}

export function clearAllData(): void {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k))
}

export const DEMO_POSITIONS: Position[] = [
  {
    id: "demo-1",
    ticker: "NVDA",
    companyName: "NVIDIA Corporation",
    logoUrl: "https://logo.clearbit.com/nvidia.com",
    category: "core",
    shares: 50,
    avgCost: 450,
    currentPrice: 875,
    targetPrice: 1200,
    stopLoss: 380,
    currency: "USD",
    exchange: "NASDAQ",
    sector: "Technology",
    thesis: "Dominant AI chip supplier. Data center revenue accelerating. Supply constrained through 2025.",
    entryDate: "2023-06-15",
    tags: ["AI", "semiconductors", "data-center"],
    notes: "Core position. Add on dips to EMA50.",
    isActive: true,
    alertEnabled: true,
    high52w: 974,
    low52w: 394,
    peRatio: 65,
    marketCap: 2160000,
  },
  {
    id: "demo-2",
    ticker: "TSMC",
    companyName: "Taiwan Semiconductor",
    logoUrl: "https://logo.clearbit.com/tsmc.com",
    category: "core",
    shares: 100,
    avgCost: 95,
    currentPrice: 148,
    targetPrice: 200,
    stopLoss: 80,
    currency: "USD",
    exchange: "NYSE",
    sector: "Technology",
    thesis: "World's most advanced foundry. Critical AI chip manufacturing partner. Geopolitical risk priced in.",
    entryDate: "2023-09-20",
    tags: ["AI", "semiconductors", "foundry"],
    notes: "High conviction. Own the picks-and-shovels of AI.",
    isActive: true,
    alertEnabled: true,
    high52w: 193,
    low52w: 88,
    peRatio: 22,
    marketCap: 770000,
  },
  {
    id: "demo-3",
    ticker: "MSFT",
    companyName: "Microsoft Corporation",
    logoUrl: "https://logo.clearbit.com/microsoft.com",
    category: "core",
    shares: 30,
    avgCost: 320,
    currentPrice: 415,
    targetPrice: 500,
    stopLoss: 280,
    currency: "USD",
    exchange: "NASDAQ",
    sector: "Technology",
    thesis: "Azure AI cloud leader. Copilot monetization underway. Excellent capital allocation.",
    entryDate: "2023-01-10",
    tags: ["AI", "cloud", "enterprise"],
    notes: "Hold long-term. Quality compounder.",
    isActive: true,
    alertEnabled: true,
    high52w: 468,
    low52w: 309,
    peRatio: 35,
    marketCap: 3090000,
  },
  {
    id: "demo-4",
    ticker: "QQQI",
    companyName: "NEOS Nasdaq 100 High Income ETF",
    logoUrl: "https://logo.clearbit.com/neosfunds.com",
    category: "etf",
    shares: 200,
    avgCost: 48,
    currentPrice: 52,
    targetPrice: 60,
    stopLoss: 42,
    currency: "USD",
    exchange: "NASDAQ",
    sector: "ETF",
    thesis: "High income ETF with Nasdaq 100 exposure. Monthly distributions for cash flow.",
    entryDate: "2024-01-05",
    tags: ["income", "etf", "covered-call"],
    notes: "Income position. Reinvest distributions.",
    isActive: true,
    alertEnabled: false,
    high52w: 55,
    low52w: 43,
  },
  {
    id: "demo-5",
    ticker: "AMD",
    companyName: "Advanced Micro Devices",
    logoUrl: "https://logo.clearbit.com/amd.com",
    category: "satellite",
    shares: 60,
    avgCost: 120,
    currentPrice: 168,
    targetPrice: 220,
    stopLoss: 100,
    currency: "USD",
    exchange: "NASDAQ",
    sector: "Technology",
    thesis: "MI300 gaining AI datacenter share. Server CPU recovery. NVDA alternative at discount.",
    entryDate: "2024-02-20",
    tags: ["AI", "semiconductors", "GPU"],
    notes: "Satellite position. Monitor MI300 adoption.",
    isActive: true,
    alertEnabled: true,
    high52w: 227,
    low52w: 108,
    peRatio: 45,
    marketCap: 272000,
  },
  {
    id: "demo-6",
    ticker: "PLTR",
    companyName: "Palantir Technologies",
    logoUrl: "https://logo.clearbit.com/palantir.com",
    category: "speculative",
    shares: 100,
    avgCost: 18,
    currentPrice: 28,
    targetPrice: 45,
    stopLoss: 14,
    currency: "USD",
    exchange: "NYSE",
    sector: "Technology",
    thesis: "AIP platform gaining US commercial traction. Government AI contracts accelerating.",
    entryDate: "2024-03-01",
    tags: ["AI", "defense", "software"],
    notes: "Speculative position. Trimming if >5% of portfolio.",
    isActive: true,
    alertEnabled: true,
    high52w: 38,
    low52w: 14,
    peRatio: 80,
    marketCap: 60000,
  },
]
