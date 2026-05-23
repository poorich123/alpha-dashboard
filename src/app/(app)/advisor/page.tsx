"use client"

import { useState, useRef, useEffect } from "react"
import { Send, Trash2, Copy, Check, Bot } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { usePortfolioStore } from "@/store/portfolioStore"
import { chatWithAdvisor } from "@/lib/claude"
import type { ChatMessage } from "@/types"
import ReactMarkdown from "react-markdown"
import toast from "react-hot-toast"
import { InlineSpinner } from "@/components/ui/LoadingSpinner"
import { format } from "date-fns"

const QUICK_PROMPTS = [
  { label: "📊 Portfolio Analysis", prompt: "Give me a complete analysis of my current portfolio. What's working, what isn't, and what's the overall assessment?" },
  { label: "🎯 What to Buy Now?", prompt: "Based on my current portfolio and cash position, what should I consider buying right now? Be specific with tickers and prices." },
  { label: "⚠️ Biggest Risks", prompt: "What are my biggest risks today? Any positions I should be worried about? What could blow up?" },
  { label: "📅 This Week", prompt: "What important events are coming up this week for my portfolio? Earnings, economic data, anything I should prepare for?" },
  { label: "💰 Deploy Cash", prompt: "I have cash to deploy. Walk me through the best opportunities in my portfolio and watchlist right now." },
  { label: "🔄 Rebalance?", prompt: "Does my portfolio need rebalancing? What's drifted too far from target allocation?" },
  { label: "📉 Crash Plan", prompt: "If the market drops 20% tomorrow, what should I do with each position? Give me a specific action plan." },
  { label: "✂️ What to Cut?", prompt: "Which positions should I consider cutting? What are the weakest links in my portfolio?" },
]

function buildPortfolioContext(
  positions: ReturnType<typeof usePortfolioStore>["positions"],
  stats: ReturnType<typeof usePortfolioStore>["stats"],
  usdThbRate: number
): string {
  if (!stats) return "No portfolio data available."

  const activePos = positions.filter((p) => p.isActive && p.category !== "watchlist")
  const positionDetails = activePos
    .map((p) => {
      const pnl = ((p.currentPrice - p.avgCost) / p.avgCost * 100).toFixed(1)
      const weight = ((p.shares * p.currentPrice / stats.totalValue) * 100).toFixed(1)
      return `• ${p.ticker} (${p.category}): ${p.shares} shares @ $${p.avgCost.toFixed(2)} avg, now $${p.currentPrice.toFixed(2)}, P&L: ${pnl}%, weight: ${weight}%${p.targetPrice > 0 ? `, target: $${p.targetPrice}` : ""}${p.stopLoss > 0 ? `, SL: $${p.stopLoss}` : ""}${p.thesis ? `\n  Thesis: ${p.thesis.slice(0, 100)}` : ""}`
    })
    .join("\n")

  return `=== PORTFOLIO SNAPSHOT ===
Total Value: $${stats.totalValue.toFixed(2)} (฿${(stats.totalValue * usdThbRate).toFixed(0)})
Cash: $${stats.cashUSD.toFixed(2)} (${((stats.cashUSD / stats.totalValue) * 100).toFixed(1)}%)
Unrealized P&L: $${stats.totalPnL.toFixed(2)} (${stats.totalPnLPercent.toFixed(2)}%)
USD/THB: ${usdThbRate.toFixed(2)}

POSITIONS:
${positionDetails}

ALLOCATION: ${JSON.stringify(stats.allocation, null, 2)}
SECTOR: ${JSON.stringify(stats.sectorAllocation, null, 2)}`
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === "user"

  async function copy() {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-[#00C2D4] flex items-center justify-center flex-shrink-0 mt-1">
          <Bot className="w-4 h-4 text-white" />
        </div>
      )}
      <div className={`max-w-[85%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? "bg-[#00C2D4] text-white rounded-tr-sm"
              : "bg-[#1A2E52] text-gray-200 rounded-tl-sm"
          }`}
        >
          {isUser ? (
            <div className="text-sm whitespace-pre-wrap">{message.content}</div>
          ) : (
            <div className="prose prose-sm prose-invert max-w-none text-sm">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 px-1">
          <span className="text-xs text-gray-600">
            {format(new Date(message.timestamp), "HH:mm")}
          </span>
          {!isUser && (
            <button onClick={copy} className="text-gray-600 hover:text-gray-400 transition-colors">
              {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AdvisorPage() {
  const { positions, stats, usdThbRate, chatMessages, addChatMessage, clearChat } = usePortfolioStore()
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMessages])

  async function sendMessage(content: string) {
    if (!content.trim() || loading) return

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: content.trim(),
      timestamp: Date.now(),
    }
    addChatMessage(userMsg)
    setInput("")
    setLoading(true)

    try {
      const context = buildPortfolioContext(positions, stats, usdThbRate)
      const allMessages = [...chatMessages, userMsg]
      const response = await chatWithAdvisor(allMessages, context)

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response,
        timestamp: Date.now(),
      }
      addChatMessage(assistantMsg)
    } catch (err) {
      toast.error("AI response failed: " + String(err))
      addChatMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: "I encountered an error. Please check your API key in Settings.",
        timestamp: Date.now(),
      })
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#1A2E52] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#00C2D4] flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-white">AI Advisor</div>
            <div className="text-xs text-green-400">Your personal CIO • Always available</div>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => { clearChat(); toast.success("Chat cleared") }}
          className="text-gray-500 hover:text-red-400"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Quick Prompts */}
      {chatMessages.length === 0 && (
        <div className="p-4 flex-shrink-0">
          <div className="text-xs text-gray-500 mb-3 text-center uppercase tracking-wide">Quick Actions</div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {QUICK_PROMPTS.map((qp) => (
              <button
                key={qp.label}
                onClick={() => sendMessage(qp.prompt)}
                className="text-xs bg-[#0C1628] border border-[#1A2E52] rounded-lg px-3 py-2 text-gray-300 hover:bg-[#1A2E52] hover:text-white transition-colors text-left"
              >
                {qp.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatMessages.length === 0 && (
          <div className="text-center py-12">
            <Bot className="w-12 h-12 text-gray-700 mx-auto mb-4" />
            <div className="text-gray-500">
              Your AI Chief Investment Officer is ready.
              <br />
              Ask anything about your portfolio.
            </div>
          </div>
        )}
        {chatMessages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-[#00C2D4] flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-[#1A2E52] rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <InlineSpinner className="text-[#00D8EE]" />
                <span>Analyzing your portfolio...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-[#1A2E52] flex-shrink-0">
        {chatMessages.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {QUICK_PROMPTS.slice(0, 4).map((qp) => (
              <button
                key={qp.label}
                onClick={() => sendMessage(qp.prompt)}
                disabled={loading}
                className="text-xs bg-[#1A2E52] border border-[#1F3566] rounded-full px-3 py-1 text-gray-400 hover:text-white hover:border-[#00C2D4] transition-colors"
              >
                {qp.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-3">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask your CIO anything... (Enter to send, Shift+Enter for newline)"
            rows={2}
            className="flex-1 bg-[#0C1628] border-[#1A2E52] text-white resize-none focus:border-[#00C2D4]"
          />
          <Button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="bg-[#00C2D4] hover:bg-[#00A8BC] self-end"
          >
            {loading ? <InlineSpinner /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  )
}
