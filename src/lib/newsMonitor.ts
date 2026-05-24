import { getMarketNews, getNews } from "./finnhub"
import type { NewsItem } from "@/types"
import type { Position } from "@/types"
import type { NewsAlert, SwingTradeSetup, ImpactLevel, Sentiment } from "@/store/alertStore"

// ─── Quick scoring (no AI needed) ────────────────────────────────────────────

const CRITICAL_KW = ["bankruptcy","bankrupt","fraud","indicted","arrested","sec investigation",
  "halt","trading halt","delisted","accounting fraud","restatement","going concern","chapter 11"]
const HIGH_KW = ["earnings","beat","miss","guidance","raised","lowered","cut","acquisition",
  "merger","fda approved","fda rejected","layoffs","fired ceo","activist","short seller",
  "data breach","cyberattack","patent","antitrust","tariff","sanction"]
const MEDIUM_KW = ["partnership","contract","analyst","upgrade","downgrade","price target",
  "buyback","dividend","conference","product launch","recall","regulatory","investigation"]

// Macro keywords — for market-wide bad news alerts (no specific ticker)
export const MACRO_KEYWORDS = [
  "fed", "fomc", "powell", "rate cut", "rate hike", "interest rate",
  "cpi", "ppi", "pce", "inflation",
  "gdp", "nfp", "payroll", "unemployment", "jobless",
  "recession", "yield curve", "treasury",
  "trump", "tariff", "china trade", "trade war",
  "oil price", "opec", "brent", "crude", "saudi", "iran", "russia", "ukraine", "war",
  "vix spike", "volatility",
  "debt ceiling", "shutdown", "default",
]
export function isMacroHeadline(headline: string, summary = ""): boolean {
  const hay = (headline + " " + summary).toLowerCase()
  return MACRO_KEYWORDS.some(k => hay.includes(k))
}

const BULLISH_KW = ["beat","surge","rally","upgrade","buy","approved","wins","gain","record",
  "record high","growth","exceed","positive","breakthrough","outperform","raised guidance",
  "strong","better than","above expectations","partnership","acquisition premium"]
const BEARISH_KW = ["miss","decline","fall","crash","downgrade","sell","rejected","loss","cut",
  "warning","concern","risk","lawsuit","investigation","disappointing","below expectations",
  "weak","halt","banned","tariff","fine","penalt","writedown","impairment"]

export function quickScoreImpact(headline: string, summary = ""): ImpactLevel {
  const text = (headline + " " + summary).toLowerCase()
  if (CRITICAL_KW.some(k => text.includes(k))) return "CRITICAL"
  if (HIGH_KW.some(k => text.includes(k))) return "HIGH"
  if (MEDIUM_KW.some(k => text.includes(k))) return "MEDIUM"
  return "LOW"
}

export function quickScoreSentiment(headline: string, summary = ""): Sentiment {
  const text = (headline + " " + summary).toLowerCase()
  const bull = BULLISH_KW.filter(k => text.includes(k)).length
  const bear = BEARISH_KW.filter(k => text.includes(k)).length
  if (bull > bear) return "BULLISH"
  if (bear > bull) return "BEARISH"
  return "NEUTRAL"
}

function getAnthropicKey(): string {
  if (typeof window === "undefined") return ""
  try {
    const raw = localStorage.getItem("alpha_settings")
    if (raw) {
      const s = JSON.parse(raw)
      if (s.anthropicApiKey && s.anthropicApiKey.length > 10) return s.anthropicApiKey
    }
  } catch {}
  return process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ""
}

// ─── AI Analysis ─────────────────────────────────────────────────────────────

async function callClaude(prompt: string): Promise<string> {
  const apiKey = getAnthropicKey()
  if (!apiKey) return ""

  try {
    const res = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey,
        messages: [{ role: "user", content: prompt }],
        system: `You are an elite quantitative trader and risk manager specializing in momentum and swing trading.
You analyze news impact on portfolios with precision. For speculative/swing positions, you provide exact entry zones,
stop losses, and take profit levels based on risk/reward optimization. You think like a hedge fund trader —
every recommendation must have a defined risk and clear exit. Return ONLY valid JSON, no explanation outside JSON.`,
      }),
    })
    if (!res.ok) return ""
    const data = await res.json()
    return data.content || ""
  } catch {
    return ""
  }
}

interface AIAnalysisResult {
  portfolioImpact: string
  immediateAction: string
  overallSentiment: Sentiment
  impactLevel: ImpactLevel
  swingSetups: SwingTradeSetup[]
}

async function analyzeWithAI(
  news: NewsItem,
  affectedPositions: Position[],
  speculativePositions: Position[]
): Promise<AIAnalysisResult> {
  const speculativeInNews = speculativePositions.filter(
    p => affectedPositions.some(ap => ap.id === p.id)
  )

  const positionDetails = affectedPositions.map(p => ({
    ticker: p.ticker,
    category: p.category,
    shares: p.shares,
    avgCost: p.avgCost,
    currentPrice: p.currentPrice,
    pnlPct: ((p.currentPrice - p.avgCost) / p.avgCost * 100).toFixed(1),
    stopLoss: p.stopLoss,
    targetPrice: p.targetPrice,
    thesis: p.thesis?.slice(0, 100),
  }))

  const prompt = `Analyze this market news and its impact on the portfolio positions.

NEWS:
Headline: "${news.headline}"
Source: ${news.source}
Summary: "${news.summary?.slice(0, 300) || "N/A"}"

AFFECTED POSITIONS:
${JSON.stringify(positionDetails, null, 2)}

Return JSON in EXACTLY this structure:
{
  "portfolioImpact": "2-3 sentence assessment of how this news impacts the overall portfolio",
  "immediateAction": "One specific immediate action to take right now (mention which tickers to open in Analyzer for technical setup)",
  "overallSentiment": "BULLISH|BEARISH|NEUTRAL",
  "impactLevel": "CRITICAL|HIGH|MEDIUM|LOW"
}

Focus on:
- Impact assessment (is this a real threat/opportunity?)
- Immediate action: what the trader should DO right now (set alerts, tighten SL, open Analyzer for ticker X, etc.)
- Sentiment: bullish/bearish/neutral overall tone
- Impact level: how urgent/important this is

Note: Technical analysis (entry/SL/TP levels) is handled by the in-app Analyzer separately. Do NOT include swing setups.`

  const response = await callClaude(prompt)
  if (!response) {
    return {
      portfolioImpact: `${news.headline} — AI analysis unavailable.`,
      immediateAction: "Monitor positions manually.",
      overallSentiment: quickScoreSentiment(news.headline, news.summary),
      impactLevel: quickScoreImpact(news.headline, news.summary),
      swingSetups: [],
    }
  }

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        portfolioImpact: parsed.portfolioImpact || "",
        immediateAction: parsed.immediateAction || "",
        overallSentiment: parsed.overallSentiment || "NEUTRAL",
        impactLevel: parsed.impactLevel || quickScoreImpact(news.headline),
        swingSetups: [],  // deprecated — use /analyzer page instead
      }
    }
  } catch {
    // fall through
  }

  return {
    portfolioImpact: response.slice(0, 300),
    immediateAction: "Review manually.",
    overallSentiment: quickScoreSentiment(news.headline),
    impactLevel: quickScoreImpact(news.headline),
    swingSetups: [],
  }
}

// ─── Main Monitor Function ────────────────────────────────────────────────────

export async function checkForAlerts(
  positions: Position[],
  lastChecked: number
): Promise<NewsAlert[]> {
  const activePositions   = positions.filter(p => p.isActive && p.category !== "watchlist")
  const watchlistPositions = positions.filter(p => p.category === "watchlist")
  const speculativePositions = activePositions.filter(p => p.category === "speculative")

  // All tickers we care about (held + watchlist)
  const heldTickers      = new Set(activePositions.map(p => p.ticker.toUpperCase()))
  const watchlistTickers = new Set(watchlistPositions.map(p => p.ticker.toUpperCase()))
  const myTickers        = new Set([...heldTickers, ...watchlistTickers])

  if (myTickers.size === 0) return []

  try {
    // Fetch general market news
    const marketNews = await getMarketNews()

    // Also fetch news for speculative positions specifically
    let speculativeNews: NewsItem[] = []
    for (const p of speculativePositions.slice(0, 3)) {
      try {
        const news = await getNews(p.ticker)
        speculativeNews = [...speculativeNews, ...news]
      } catch {
        // ignore rate limit
      }
    }

    // Combine and deduplicate
    const allNews = [...marketNews, ...speculativeNews]
    const seenIds = new Set<number>()
    const uniqueNews = allNews.filter(n => {
      if (seenIds.has(n.id)) return false
      seenIds.add(n.id)
      return true
    })

    // Filter: only news NEWER than last check + relevant to portfolio or watchlist
    const cutoffTime = lastChecked / 1000 // convert to unix seconds
    const relevantNews = uniqueNews.filter(n => {
      if (n.datetime < cutoffTime) return false

      const text = (n.headline + " " + (n.summary || "") + " " + (n.related || "")).toUpperCase()
      const mentionsTicker = Array.from(myTickers).some(t => text.includes(t))
      const isHighImpact = quickScoreImpact(n.headline, n.summary) !== "LOW"

      return mentionsTicker || (isHighImpact && quickScoreSentiment(n.headline) !== "NEUTRAL")
    })


    if (relevantNews.length === 0) return []

    const alerts: NewsAlert[] = []

    // Process top relevant news (max 5 to avoid API spam)
    for (const news of relevantNews.slice(0, 5)) {
      const text = (news.headline + " " + (news.summary || "") + " " + (news.related || "")).toUpperCase()

      // Find which positions are affected
      const affectedPositions   = activePositions.filter(p => text.includes(p.ticker.toUpperCase()))
      const affectedWatchlist   = watchlistPositions.filter(p => text.includes(p.ticker.toUpperCase()))
      const affectedSpeculative = affectedPositions.filter(p => p.category === "speculative")

      const impact = quickScoreImpact(news.headline, news.summary)
      const sentiment = quickScoreSentiment(news.headline, news.summary)

      // Skip LOW impact with no affected positions (held or watchlist)
      if (impact === "LOW" && affectedPositions.length === 0 && affectedWatchlist.length === 0) continue

      let alert: NewsAlert

      // Use AI for HIGH/CRITICAL or speculative positions
      const needsAI = impact === "CRITICAL" || impact === "HIGH" || affectedSpeculative.length > 0

      // Watchlist-only alert (no held positions affected)
      const isWatchlistOnly = affectedPositions.length === 0 && affectedWatchlist.length > 0

      if (isWatchlistOnly) {
        // Lightweight alert for watchlist — no AI needed
        alert = {
          id: crypto.randomUUID(),
          timestamp: news.datetime * 1000,
          tickers: affectedWatchlist.map(p => p.ticker),
          headline: news.headline,
          source: news.source,
          url: news.url,
          impact,
          sentiment,
          type: "WATCHLIST",
          portfolioAssessment: `Watchlist signal: ${affectedWatchlist.map(p => p.ticker).join(", ")}. ${sentiment} news — review entry opportunity.`,
          immediateAction: sentiment === "BULLISH"
            ? "Consider entry if setup confirms. Check technicals."
            : sentiment === "BEARISH"
            ? "Monitor for further weakness before entry."
            : "Track price action.",
          swingSetups: [],
          read: false,
          articleId: news.id,
        }
      } else if (needsAI) {
        const aiResult = await analyzeWithAI(news, affectedPositions, speculativePositions)
        alert = {
          id: crypto.randomUUID(),
          timestamp: news.datetime * 1000,
          tickers: [
            ...affectedPositions.map(p => p.ticker),
            ...affectedWatchlist.map(p => p.ticker),
          ],
          headline: news.headline,
          source: news.source,
          url: news.url,
          impact: aiResult.impactLevel,
          sentiment: aiResult.overallSentiment,
          type: affectedSpeculative.length > 0 ? "SPECULATIVE"
                : affectedPositions.length > 1 ? "PORTFOLIO"
                : affectedPositions.length === 1 ? "INDIVIDUAL"
                : "MARKET",
          portfolioAssessment: aiResult.portfolioImpact,
          immediateAction: aiResult.immediateAction,
          swingSetups: aiResult.swingSetups,
          read: false,
          articleId: news.id,
        }
      } else {
        // Basic alert without AI
        alert = {
          id: crypto.randomUUID(),
          timestamp: news.datetime * 1000,
          tickers: [
            ...affectedPositions.map(p => p.ticker),
            ...affectedWatchlist.map(p => `${p.ticker}*`), // * = watchlist
          ],
          headline: news.headline,
          source: news.source,
          url: news.url,
          impact,
          sentiment,
          type: affectedPositions.length > 1 ? "PORTFOLIO"
                : affectedPositions.length === 1 ? "INDIVIDUAL"
                : "MARKET",
          portfolioAssessment: `${sentiment} signal detected. ${affectedPositions.length > 0
            ? `Affects: ${affectedPositions.map(p => p.ticker).join(", ")}.`
            : "Monitor general market conditions."}`,
          immediateAction: sentiment === "BEARISH"
            ? "Review stop losses for affected positions."
            : "Monitor for follow-through.",
          swingSetups: [],
          read: false,
          articleId: news.id,
        }
      }

      alerts.push(alert)
    }

    return alerts
  } catch {
    return []
  }
}

// ─── Macro alerts ────────────────────────────────────────────────────────────
//
// Watches general market news for macro events (Fed/CPI/oil/war/etc).
// Fires alerts for BEARISH headlines with HIGH/CRITICAL impact — no specific
// ticker, tagged with "MACRO" as a pseudo-ticker.
//
export async function checkForMacroAlerts(lastChecked: number): Promise<NewsAlert[]> {
  try {
    const marketNews = await getMarketNews()
    const cutoff = lastChecked / 1000

    const candidates = marketNews.filter(n => {
      if (n.datetime < cutoff) return false
      if (!isMacroHeadline(n.headline, n.summary)) return false
      const impact = quickScoreImpact(n.headline, n.summary)
      const sentiment = quickScoreSentiment(n.headline, n.summary)
      return (impact === "HIGH" || impact === "CRITICAL") && sentiment === "BEARISH"
    })

    if (candidates.length === 0) return []

    return candidates.slice(0, 3).map((n): NewsAlert => ({
      id: `macro-${n.id}-${Date.now()}`,
      timestamp: Date.now(),
      tickers: ["MACRO"],
      headline: n.headline,
      source: n.source,
      url: n.url,
      impact: quickScoreImpact(n.headline, n.summary),
      sentiment: "BEARISH",
      type: "MARKET",
      portfolioAssessment: `Market-wide macro risk — affects broad indices and risk-on sectors. Monitor portfolio for correlation.`,
      immediateAction: "Review Macro Risk dashboard + consider hedging or reducing risk exposure.",
      swingSetups: [],
      read: false,
      articleId: n.id,
    }))
  } catch {
    return []
  }
}
