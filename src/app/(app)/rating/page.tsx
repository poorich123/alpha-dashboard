"use client"

import { useState } from "react"
import { Trophy, Star, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { usePortfolioStore } from "@/store/portfolioStore"
import { calculateAlphaScore } from "@/lib/claude"
import { InlineSpinner } from "@/components/ui/LoadingSpinner"
import ReactMarkdown from "react-markdown"

const SCORE_DIMENSIONS = [
  {
    key: "quality",
    label: "Quality",
    description: "Are holdings high-quality businesses?",
    icon: "💎",
  },
  {
    key: "momentum",
    label: "Momentum",
    description: "Are holdings in uptrends?",
    icon: "📈",
  },
  {
    key: "diversification",
    label: "Diversification",
    description: "Spread across sectors and categories",
    icon: "🎯",
  },
  {
    key: "riskManagement",
    label: "Risk Management",
    description: "Stop losses set, appropriate position sizes",
    icon: "🛡️",
  },
  {
    key: "catalyst",
    label: "Catalyst",
    description: "Upcoming positive events",
    icon: "⚡",
  },
  {
    key: "valuation",
    label: "Valuation",
    description: "Holdings not dangerously overvalued",
    icon: "💰",
  },
  {
    key: "thesisAlignment",
    label: "Thesis Alignment",
    description: "Holdings align with stated strategy",
    icon: "🧠",
  },
]

function getBadge(score: number): { emoji: string; label: string; color: string } {
  if (score >= 90) return { emoji: "🏆", label: "World Class Hedge Fund", color: "text-yellow-400" }
  if (score >= 75) return { emoji: "⭐", label: "Professional Grade", color: "text-blue-400" }
  if (score >= 60) return { emoji: "✅", label: "Solid Investor", color: "text-green-400" }
  if (score >= 45) return { emoji: "⚠️", label: "Needs Improvement", color: "text-yellow-400" }
  return { emoji: "🔴", label: "High Risk / Restructure", color: "text-red-400" }
}

function getScoreColor(score: number): string {
  if (score >= 8) return "bg-green-500"
  if (score >= 6) return "bg-blue-500"
  if (score >= 4) return "bg-yellow-500"
  return "bg-red-500"
}

export default function RatingPage() {
  const { positions, stats } = usePortfolioStore()
  const [scores, setScores] = useState<Record<string, number>>({})
  const [analysis, setAnalysis] = useState("")
  const [loading, setLoading] = useState(false)
  const [parsed, setParsed] = useState<{
    strengths?: string[]
    improvements?: string[]
    urgentAction?: string | null
  }>({})

  const totalScore =
    Object.keys(scores).length > 0
      ? Math.round(
          (Object.values(scores).reduce((a, b) => a + b, 0) / (SCORE_DIMENSIONS.length * 10)) * 100
        )
      : 0

  const badge = getBadge(totalScore)

  async function runAnalysis() {
    if (!positions.length || !stats) return
    setLoading(true)
    try {
      const { scores: newScores, analysis: rawAnalysis } = await calculateAlphaScore(positions, stats)
      setScores(newScores)
      setAnalysis(rawAnalysis)

      // Try parse JSON from response
      try {
        const jsonMatch = rawAnalysis.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[0])
          setParsed({
            strengths: data.strengths,
            improvements: data.improvements,
            urgentAction: data.urgentAction,
          })
        }
      } catch {
        // use raw analysis
      }

      // Update store alpha score
      usePortfolioStore.setState((s) => ({
        stats: s.stats ? { ...s.stats, alphaScore: Math.round((Object.values(newScores).reduce((a, b) => a + b, 0) / (SCORE_DIMENSIONS.length * 10)) * 100) } : s.stats,
      }))
    } catch (err) {
      setAnalysis("Analysis failed: " + String(err))
    } finally {
      setLoading(false)
    }
  }

  const activeCount = positions.filter((p) => p.isActive && p.category !== "watchlist").length

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Portfolio Rating</h1>
        <Button
          onClick={runAnalysis}
          disabled={loading || activeCount === 0}
          className="bg-[#00C2D4] hover:bg-[#00A8BC]"
        >
          {loading ? (
            <><InlineSpinner className="mr-2" />Analyzing...</>
          ) : (
            <><RefreshCw className="w-4 h-4 mr-1" />Run Analysis</>
          )}
        </Button>
      </div>

      {activeCount === 0 && (
        <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-8 text-center text-gray-500">
          Add positions to your portfolio to get a rating
        </div>
      )}

      {activeCount > 0 && (
        <div className="space-y-6">
          {/* Alpha Score Gauge */}
          <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-6 text-center">
            {totalScore > 0 ? (
              <>
                <div className="text-7xl font-bold text-white mb-2">{totalScore}</div>
                <div className="text-gray-500 text-sm mb-3">Alpha Score / 100</div>
                <div className={`text-2xl font-bold ${badge.color}`}>
                  {badge.emoji} {badge.label}
                </div>
                <div className="mt-4 h-3 bg-[#1A2E52] rounded-full overflow-hidden max-w-xs mx-auto">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${totalScore}%`,
                      background: "linear-gradient(90deg, #00C2D4, #00C2D4)",
                    }}
                  />
                </div>
              </>
            ) : (
              <div className="py-4">
                <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <div className="text-gray-400 text-sm mb-2">No score yet</div>
                <div className="text-gray-600 text-xs">Run analysis to get your Alpha Score</div>
              </div>
            )}
          </div>

          {/* Sub-Scores */}
          <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-4">Score Breakdown</div>
            <div className="space-y-4">
              {SCORE_DIMENSIONS.map((dim) => {
                const score = scores[dim.key] ?? null
                return (
                  <div key={dim.key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{dim.icon}</span>
                        <div>
                          <div className="text-sm font-medium text-white">{dim.label}</div>
                          <div className="text-xs text-gray-500">{dim.description}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        {score !== null ? (
                          <>
                            <div className="text-lg font-bold text-white">{score}</div>
                            <div className="text-xs text-gray-500">/10</div>
                          </>
                        ) : (
                          <div className="text-gray-600 text-sm">—</div>
                        )}
                      </div>
                    </div>
                    <Progress
                      value={score !== null ? score * 10 : 0}
                      className={`h-2 bg-[#1A2E52] ${score !== null ? "" : "opacity-30"}`}
                      style={score !== null ? {
                        "--progress-bg": getScoreColor(score),
                      } as React.CSSProperties : {}}
                    />
                  </div>
                )
              })}
            </div>
          </div>

          {/* Strengths & Improvements */}
          {(parsed.strengths || parsed.improvements) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {parsed.strengths && (
                <div className="bg-[#0C1628] border border-green-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Star className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-gray-500 uppercase tracking-wide">Portfolio Strengths</span>
                  </div>
                  <ul className="space-y-2">
                    {parsed.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                        <span className="text-green-400 mt-0.5">✓</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {parsed.improvements && (
                <div className="bg-[#0C1628] border border-yellow-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <RefreshCw className="w-4 h-4 text-yellow-400" />
                    <span className="text-xs text-gray-500 uppercase tracking-wide">Improvements</span>
                  </div>
                  <ul className="space-y-2">
                    {parsed.improvements.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                        <span className="text-yellow-400 mt-0.5">→</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Urgent Action */}
          {parsed.urgentAction && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <div className="text-xs text-red-400 uppercase tracking-wide mb-2">⚠️ Urgent Action</div>
              <div className="text-sm text-red-300">{parsed.urgentAction}</div>
            </div>
          )}

          {/* Full AI Analysis */}
          {analysis && !parsed.strengths && (
            <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-4">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-3">AI Analysis</div>
              <div className="prose prose-sm prose-invert max-w-none text-gray-300">
                <ReactMarkdown>{analysis}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
