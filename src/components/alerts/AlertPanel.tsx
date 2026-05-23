"use client"

import { useEffect, useRef, useState } from "react"
import { useAlertStore } from "@/store/alertStore"
import type { NewsAlert } from "@/store/alertStore"
import {
  Bell, X, ChevronDown, ChevronUp, TrendingUp, TrendingDown,
  Minus, Zap, Clock, ExternalLink, CheckCheck, Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { getDrawCard, getRoundIcon, PAGE_CHARACTERS } from "@/components/hsr/characters"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(ts: number) {
  try { return formatDistanceToNow(new Date(ts), { addSuffix: true }) }
  catch { return "recently" }
}

function impactBorder(impact: string) {
  if (impact === "CRITICAL") return "border-red-500/40 bg-red-500/5"
  if (impact === "HIGH")     return "border-orange-500/40 bg-orange-500/5"
  if (impact === "MEDIUM")   return "border-yellow-500/30 bg-yellow-500/5"
  return "border-[#1A2E52] bg-[#0C1628]/60"
}

function impactBadge(impact: string) {
  if (impact === "CRITICAL") return "text-red-400 bg-red-500/15 border-red-500/40"
  if (impact === "HIGH")     return "text-orange-400 bg-orange-500/15 border-orange-500/40"
  if (impact === "MEDIUM")   return "text-yellow-400 bg-yellow-500/15 border-yellow-500/40"
  return "text-gray-400 bg-gray-500/10 border-gray-700"
}

function impactBar(impact: string) {
  if (impact === "CRITICAL") return "bg-red-500"
  if (impact === "HIGH")     return "bg-orange-500"
  if (impact === "MEDIUM")   return "bg-yellow-500"
  return "bg-gray-600"
}

function actionStyle(action: string) {
  if (action === "BUY"  || action === "ADD")  return "text-emerald-400 bg-emerald-500/15 border-emerald-500/40"
  if (action === "EXIT_NOW")                  return "text-red-400 bg-red-500/15 border-red-500/40"
  if (action === "REDUCE")                    return "text-orange-400 bg-orange-500/15 border-orange-500/40"
  return "text-cyan-400 bg-cyan-500/15 border-cyan-500/40"
}

function confidenceColor(c: number) {
  if (c >= 8) return "text-emerald-400"
  if (c >= 6) return "text-yellow-400"
  return "text-red-400"
}


// ─── Alert Card ───────────────────────────────────────────────────────────────

function AlertCard({ alert, onRead }: { alert: NewsAlert; onRead: (id: string) => void }) {
  const [expanded, setExpanded] = useState(!alert.read && (alert.impact === "CRITICAL" || alert.impact === "HIGH"))

  const SentimentIcon = alert.sentiment === "BULLISH" ? TrendingUp
    : alert.sentiment === "BEARISH" ? TrendingDown : Minus
  const sentimentColor = alert.sentiment === "BULLISH" ? "text-emerald-400"
    : alert.sentiment === "BEARISH" ? "text-red-400" : "text-gray-500"

  return (
    <div
      className={cn(
        "relative rounded-xl border transition-all overflow-hidden",
        impactBorder(alert.impact),
        alert.impact === "CRITICAL" && !alert.read && "hsr-scan"
      )}
      onClick={() => { if (!alert.read) onRead(alert.id) }}
    >
      {/* Top accent bar */}
      <div className={cn("h-0.5 w-full", impactBar(alert.impact))} />

      <div className="p-3">
        <div className="flex items-start gap-2 mb-2">
          <div className="flex-1 min-w-0">
            {/* Badges row */}
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-wide", impactBadge(alert.impact))}>
                {alert.impact}
              </span>
              <SentimentIcon className={cn("w-3 h-3", sentimentColor)} />
              <span className={cn("text-[10px] font-medium", sentimentColor)}>{alert.sentiment}</span>
              {alert.tickers.map(t => (
                <span key={t} className="text-[10px] bg-[#1A2E52] text-cyan-300 px-1.5 py-0.5 rounded font-mono border border-[#1A3A5C]">{t}</span>
              ))}
              {alert.type === "WATCHLIST" && (
                <span className="text-[10px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/20">WATCHLIST</span>
              )}
            </div>
            {/* Headline */}
            <p className={cn("text-sm font-medium leading-snug", alert.read ? "text-gray-500" : "text-white")}>
              {alert.headline}
            </p>
            {/* Meta */}
            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-600">
              <span>{alert.source}</span>
              <span>·</span>
              <Clock className="w-2.5 h-2.5" />
              <span>{timeAgo(alert.timestamp)}</span>
              {alert.url && (
                <a href={alert.url} target="_blank" rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()} className="text-cyan-700 hover:text-cyan-400">
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>
          </div>

          <button
            onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
            className="text-gray-600 hover:text-gray-300 mt-0.5"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {expanded && (
          <div className="space-y-2 pl-3 border-l-2 border-[#1A2E52]">
            {alert.portfolioAssessment && (
              <p className="text-xs text-gray-400 leading-relaxed">{alert.portfolioAssessment}</p>
            )}
            {alert.immediateAction && (
              <div className="flex items-start gap-1.5 bg-[#071220] border border-[#00C2D4]/20 rounded-lg px-2 py-1.5">
                <Zap className="w-3 h-3 text-[#00C2D4] mt-0.5 flex-shrink-0" />
                <p className="text-xs text-[#00D8EE] font-medium">{alert.immediateAction}</p>
              </div>
            )}
            {/* Affected tickers — quick analyze link */}
            {alert.tickers.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap pt-1">
                <span className="text-[10px] text-gray-600">Analyze:</span>
                {alert.tickers.slice(0, 3).map(t => (
                  <a
                    key={t}
                    href={`/analyzer?ticker=${t.replace(/\*$/,"")}`}
                    className="text-[10px] bg-[#00C2D4]/10 hover:bg-[#00C2D4]/20 text-[#00D8EE] px-1.5 py-0.5 rounded border border-[#00C2D4]/30 transition-colors"
                  >
                    📊 {t.replace(/\*$/,"")}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function AlertPanel() {
  const {
    alerts, unreadCount, panelOpen, isMonitoring,
    setPanelOpen, markRead, markAllRead, clearAlerts, loadFromStorage
  } = useAlertStore()

  const panelRef  = useRef<HTMLDivElement>(null)
  const bellRef   = useRef<HTMLButtonElement>(null)
  const [shaking, setShaking] = useState(false)
  const prevUnread = useRef(unreadCount)

  const kafka   = PAGE_CHARACTERS.alerts
  const criticalCount = alerts.filter(a => !a.read && a.impact === "CRITICAL").length

  useEffect(() => { loadFromStorage() }, [loadFromStorage])

  // Shake bell on new alerts
  useEffect(() => {
    if (unreadCount > prevUnread.current) {
      setShaking(true)
      setTimeout(() => setShaking(false), 600)
    }
    prevUnread.current = unreadCount
  }, [unreadCount])

  // Close on outside click
  useEffect(() => {
    if (!panelOpen) return
    function handler(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        bellRef.current  && !bellRef.current.contains(e.target as Node)
      ) setPanelOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [panelOpen, setPanelOpen])

  return (
    <>
      {/* ── Floating Bell ─────────────────────── */}
      <button
        ref={bellRef}
        onClick={() => setPanelOpen(!panelOpen)}
        className={cn(
          "fixed top-4 right-4 z-50 w-10 h-10 rounded-full flex items-center justify-center transition-all",
          "bg-[#0C1628] border border-[#1A2E52] hover:border-[#00C2D4] hover:bg-[#00C2D4]/10",
          criticalCount > 0 && "critical-pulse border-red-500/50",
          panelOpen && "bg-[#00C2D4]/15 border-[#00C2D4]"
        )}
      >
        <Bell className={cn(
          "w-5 h-5 transition-colors",
          criticalCount > 0 ? "text-red-400" : unreadCount > 0 ? "text-[#00C2D4]" : "text-gray-500",
          shaking && "badge-shake"
        )} />
        {unreadCount > 0 && (
          <span className={cn(
            "absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1",
            criticalCount > 0 ? "bg-red-500 text-white" : "bg-[#00C2D4] text-[#070B18]",
            shaking && "badge-shake"
          )}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Live dot */}
      {isMonitoring && (
        <div className="fixed top-[58px] right-[22px] z-50">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </div>
      )}

      {/* ── Slide-out Panel ───────────────────── */}
      <div
        ref={panelRef}
        className={cn(
          "fixed top-0 right-0 h-screen w-[440px] max-w-[100vw] z-50",
          "bg-[#070B18] border-l border-[#1A2E52] flex flex-col",
          "transform transition-transform duration-300 ease-in-out",
          panelOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* ── Kafka character header ─────────── */}
        <div
          className="relative overflow-hidden flex-shrink-0"
          style={{ height: "120px", background: `linear-gradient(135deg, #070B18 0%, #12082A 60%, ${kafka.glowColor.replace("0.4","0.2")} 100%)` }}
        >
          {/* Kafka splash art */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getDrawCard(kafka.id)}
            alt={kafka.name}
            className="absolute right-0 top-0 h-full object-cover object-top"
            style={{ width: "auto", maskImage: "linear-gradient(to left, rgba(0,0,0,0.9) 20%, transparent 100%)" }}
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0" style={{ background: "linear-gradient(to right, #070B18 35%, transparent 75%)" }} />

          {/* Corner lines */}
          <div className="absolute top-0 left-0 w-6 h-px" style={{ background: kafka.color }} />
          <div className="absolute top-0 left-0 w-px h-6" style={{ background: kafka.color }} />

          {/* Header content */}
          <div className="relative z-10 p-4 h-full flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-widest font-semibold mb-0.5" style={{ color: kafka.color }}>
                  {kafka.role}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-white">{kafka.name}</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={getRoundIcon(kafka.id)} alt="" className="w-5 h-5 rounded-full border opacity-60" style={{ borderColor: kafka.color }} />
                </div>
              </div>
              <button onClick={() => setPanelOpen(false)} className="text-gray-600 hover:text-white transition-colors mt-0.5">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Status row */}
            <div className="flex items-center gap-2">
              <div className={cn(
                "flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border",
                isMonitoring
                  ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                  : "text-gray-600 border-gray-700"
              )}>
                <div className={cn("w-1 h-1 rounded-full", isMonitoring ? "bg-emerald-400 animate-pulse" : "bg-gray-600")} />
                {isMonitoring ? "Monitoring Active" : "Offline"}
              </div>
              {unreadCount > 0 && (
                <span className="text-[10px] bg-[#00C2D4]/15 border border-[#00C2D4]/20 text-[#00D8EE] px-2 py-0.5 rounded-full">
                  {unreadCount} unread
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Alert actions bar ─────────────── */}
        {alerts.length > 0 && (
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#0C1628]/50 border-b border-[#1A2E52]/50 flex-shrink-0">
            <div className="flex gap-1">
              {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map(level => {
                const count = alerts.filter(a => a.impact === level).length
                if (!count) return null
                return (
                  <span key={level} className={cn("text-[9px] px-1.5 py-0.5 rounded border font-semibold", impactBadge(level))}>
                    {level[0]}{level.slice(1).toLowerCase()} ×{count}
                  </span>
                )
              })}
            </div>
            <div className="flex gap-1">
              <button onClick={markAllRead} className="text-gray-600 hover:text-gray-300 p-1 rounded hover:bg-[#1A2E52]" title="Mark all read">
                <CheckCheck className="w-3.5 h-3.5" />
              </button>
              <button onClick={clearAlerts} className="text-gray-600 hover:text-red-400 p-1 rounded hover:bg-red-500/10" title="Clear all">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ── Content area ──────────────────── */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <div className="w-14 h-14 rounded-full bg-[#0C1628] border border-[#1A2E52] flex items-center justify-center">
                <Bell className="w-6 h-6 text-gray-700" />
              </div>
              <p className="text-gray-500 text-sm font-medium">No alerts yet</p>
              <p className="text-gray-700 text-xs">
                {isMonitoring ? "Monitoring your portfolio news every 5 min…" : "Monitoring will start shortly"}
              </p>
            </div>
          ) : (
            alerts.map(alert => (
              <AlertCard key={alert.id} alert={alert} onRead={markRead} />
            ))
          )}
        </div>

        {/* ── Footer ────────────────────────── */}
        <div className="px-4 py-2 border-t border-[#1A2E52] bg-[#0C1628]/50 flex-shrink-0">
          <p className="text-[10px] text-gray-700 text-center">
            Checks every 5 min • {alerts.length} alert{alerts.length !== 1 ? "s" : ""} · use <span className="text-cyan-500">Analyzer</span> for swing setups
          </p>
        </div>
      </div>

      {/* Backdrop */}
      {panelOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={() => setPanelOpen(false)} />
      )}
    </>
  )
}
