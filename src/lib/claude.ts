import type { Position, PortfolioStats, NewsItem, EconomicEvent, ChatMessage, TechnicalAnalysis } from "@/types"

function getAnthropicKey(): string {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("alpha_settings")
      if (raw) {
        const s = JSON.parse(raw)
        if (s.anthropicApiKey && s.anthropicApiKey.length > 10) return s.anthropicApiKey
      }
    } catch {}
  }
  return process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ""
}

async function claudeFetch(messages: Array<{ role: string; content: string }>, system?: string): Promise<string> {
  const apiKey = getAnthropicKey()
  if (!apiKey || apiKey === "your_anthropic_key_here") {
    return "⚠️ Anthropic API key not configured. Please add your key in Settings."
  }

  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // Pass key from client so server-side route can use it
    body: JSON.stringify({ messages, system, apiKey }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Claude API error: ${err}`)
  }

  const data = await res.json()
  return data.content
}

const CIO_SYSTEM_PROMPT = `You are the Chief Investment Officer of an elite hedge fund with 30+ years experience managing multi-billion dollar portfolios. You combine the macro vision of Ray Dalio, the value discipline of Howard Marks, the concentrated bets of Stanley Druckenmiller, and the growth instincts of Cathie Wood.

You have real-time access to this user's complete portfolio data, current market prices, technical indicators, recent news, and upcoming events. Your advice is direct, specific, and always actionable. You cite exact prices, percentages, and position sizes. You never give vague answers. You proactively warn about risks the user may not have considered.

The portfolio is focused on the AI infrastructure supercycle with exposure to chips, foundries, equipment, data centers, and power. The user is a Thai retail investor with a long time horizon.

Format responses with markdown. Use bullet points and headers for clarity. Be concise but comprehensive.`

export async function analyzePortfolio(stats: PortfolioStats): Promise<string> {
  const positionsSummary = stats.positions
    .map(
      (p) =>
        `${p.ticker}: ${p.shares} shares @ $${p.avgCost.toFixed(2)} avg, current $${p.currentPrice.toFixed(2)}, ` +
        `P&L: ${(((p.currentPrice - p.avgCost) / p.avgCost) * 100).toFixed(1)}%, weight: ${((p.shares * p.currentPrice / stats.totalValue) * 100).toFixed(1)}%`
    )
    .join("\n")

  const prompt = `Analyze this portfolio:

Total Value: $${stats.totalValue.toFixed(2)}
Total P&L: ${stats.totalPnLPercent.toFixed(2)}%
Cash: $${stats.cashUSD.toFixed(2)} (${((stats.cashUSD / stats.totalValue) * 100).toFixed(1)}%)

Positions:
${positionsSummary}

Allocation: ${JSON.stringify(stats.allocation)}
Sector Allocation: ${JSON.stringify(stats.sectorAllocation)}

Provide: 3 strengths, 3 improvement areas, 1 immediate action if needed.`

  return claudeFetch([{ role: "user", content: prompt }], CIO_SYSTEM_PROMPT)
}

export async function generateMarketBrief(
  news: NewsItem[],
  events: EconomicEvent[],
  positions: Position[]
): Promise<string> {
  const tickers = positions.map((p) => p.ticker).join(", ")
  const topNews = news
    .slice(0, 10)
    .map((n) => `- ${n.headline} (${n.source})`)
    .join("\n")
  const upcomingEvents = events
    .slice(0, 5)
    .map((e) => `- ${e.event}: prev ${e.prev}, est ${e.estimate}`)
    .join("\n")

  const prompt = `Generate a concise morning market brief for a portfolio holding: ${tickers}

Recent news:
${topNews}

Upcoming economic events:
${upcomingEvents}

Provide 3-5 bullet points on what matters today for THIS specific portfolio. Be direct and actionable.`

  return claudeFetch([{ role: "user", content: prompt }], CIO_SYSTEM_PROMPT)
}

export async function analyzeStock(
  ticker: string,
  technicals: TechnicalAnalysis,
  news: NewsItem[]
): Promise<string> {
  const topNews = news
    .slice(0, 5)
    .map((n) => `- ${n.headline}`)
    .join("\n")

  const prompt = `Analyze ${ticker} with these technicals:
RSI: ${technicals.rsi.toFixed(1)}
Trend: ${technicals.trend}
Signal: ${technicals.signal}
Above EMA50: ${technicals.aboveEma50}
Above EMA200: ${technicals.aboveEma200}
MACD: ${technicals.macd.toFixed(3)} (Signal: ${technicals.macdSignal.toFixed(3)})
Support: $${technicals.support1.toFixed(2)} / $${technicals.support2.toFixed(2)}
Resistance: $${technicals.resistance1.toFixed(2)} / $${technicals.resistance2.toFixed(2)}

Recent news:
${topNews}

Provide: current setup, entry zones, key risk levels, trade recommendation.`

  return claudeFetch([{ role: "user", content: prompt }], CIO_SYSTEM_PROMPT)
}

export async function chatWithAdvisor(
  messages: ChatMessage[],
  portfolioContext: string
): Promise<string> {
  const systemWithContext = `${CIO_SYSTEM_PROMPT}

CURRENT PORTFOLIO CONTEXT:
${portfolioContext}`

  const apiMessages = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  return claudeFetch(apiMessages, systemWithContext)
}

export async function calculateAlphaScore(
  positions: Position[],
  stats: PortfolioStats
): Promise<{ scores: Record<string, number>; analysis: string }> {
  const positionsSummary = positions
    .map(
      (p) =>
        `${p.ticker}: category=${p.category}, weight=${((p.shares * p.currentPrice / stats.totalValue) * 100).toFixed(1)}%, ` +
        `SL set=${p.stopLoss > 0}, target=${p.targetPrice > 0}, thesis="${p.thesis?.slice(0, 50)}"`
    )
    .join("\n")

  const prompt = `Score this portfolio on 7 dimensions (0-10 each):

Positions:
${positionsSummary}

Allocation: ${JSON.stringify(stats.allocation)}
Cash: ${((stats.cashUSD / stats.totalValue) * 100).toFixed(1)}%

Return JSON:
{
  "quality": 0-10,
  "momentum": 0-10,
  "diversification": 0-10,
  "riskManagement": 0-10,
  "catalyst": 0-10,
  "valuation": 0-10,
  "thesisAlignment": 0-10,
  "strengths": ["point1", "point2", "point3"],
  "improvements": ["point1", "point2", "point3"],
  "urgentAction": "string or null"
}`

  const response = await claudeFetch(
    [{ role: "user", content: prompt }],
    "You are a portfolio analyst. Return only valid JSON."
  )

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0])
      const scores = {
        quality: data.quality || 5,
        momentum: data.momentum || 5,
        diversification: data.diversification || 5,
        riskManagement: data.riskManagement || 5,
        catalyst: data.catalyst || 5,
        valuation: data.valuation || 5,
        thesisAlignment: data.thesisAlignment || 5,
      }
      return { scores, analysis: response }
    }
  } catch {
    // fall through to default
  }

  return {
    scores: {
      quality: 7,
      momentum: 7,
      diversification: 6,
      riskManagement: 7,
      catalyst: 7,
      valuation: 6,
      thesisAlignment: 8,
    },
    analysis: response,
  }
}
