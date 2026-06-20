import { create } from "zustand"
import type { TechnicalScanResult } from "@/lib/swingScanner"
import type { PositionRiskSignal } from "@/lib/positionRisk"

export type ImpactLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
export type Sentiment = "BULLISH" | "BEARISH" | "NEUTRAL"
export type AlertType = "PORTFOLIO" | "SPECULATIVE" | "INDIVIDUAL" | "MARKET" | "WATCHLIST"
export type SwingAction = "BUY" | "ADD" | "HOLD" | "REDUCE" | "EXIT_NOW"

export interface SwingTradeSetup {
  ticker: string
  action: SwingAction
  currentPrice: number
  entryLow: number
  entryHigh: number
  stopLoss: number
  stopLossPercent: number
  tp1: number
  tp1Percent: number
  tp2: number
  tp2Percent: number
  tp3: number
  tp3Percent: number
  riskReward: number
  timeframe: "INTRADAY" | "1-3 DAYS" | "1-2 WEEKS" | "1 MONTH"
  confidence: number // 1-10
  reasoning: string
  catalysts: string[]
  keyRisks: string[]
  positionSizePercent: number // recommended % of portfolio
}

export interface NewsAlert {
  id: string
  timestamp: number
  tickers: string[]
  headline: string
  source: string
  url: string
  impact: ImpactLevel
  sentiment: Sentiment
  type: AlertType
  portfolioAssessment: string
  immediateAction: string
  swingSetups: SwingTradeSetup[]
  read: boolean
  articleId?: number
}

interface AlertStore {
  alerts: NewsAlert[]
  lastChecked: number
  isMonitoring: boolean
  unreadCount: number
  panelOpen: boolean
  soundEnabled: boolean
  watchlistScans: Record<string, TechnicalScanResult>  // ticker → scan result
  positionRiskSignals: Record<string, PositionRiskSignal>  // ticker → de-risk signal

  addAlert: (alert: NewsAlert) => void
  markRead: (id: string) => void
  markAllRead: () => void
  clearAlerts: () => void
  setLastChecked: (t: number) => void
  setMonitoring: (v: boolean) => void
  setPanelOpen: (v: boolean) => void
  setSoundEnabled: (v: boolean) => void
  loadFromStorage: () => void
  setWatchlistScans: (scans: Record<string, TechnicalScanResult>) => void
  setPositionRiskSignals: (signals: Record<string, PositionRiskSignal>) => void
}

const STORAGE_KEY = "alpha_alerts"
const SOUND_KEY = "alpha_alerts_sound"
const MAX_ALERTS = 50

export const useAlertStore = create<AlertStore>((set, get) => ({
  alerts: [],
  lastChecked: Date.now() - 30 * 60 * 1000, // start 30min ago
  isMonitoring: false,
  unreadCount: 0,
  panelOpen: false,
  soundEnabled: true,
  watchlistScans: {},
  positionRiskSignals: {},

  addAlert: (alert) => {
    const alerts = [alert, ...get().alerts].slice(0, MAX_ALERTS)
    const unreadCount = alerts.filter((a) => !a.read).length
    set({ alerts, unreadCount })
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ alerts, lastChecked: get().lastChecked }))
    }
  },

  markRead: (id) => {
    const alerts = get().alerts.map((a) => (a.id === id ? { ...a, read: true } : a))
    const unreadCount = alerts.filter((a) => !a.read).length
    set({ alerts, unreadCount })
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ alerts, lastChecked: get().lastChecked }))
    }
  },

  markAllRead: () => {
    const alerts = get().alerts.map((a) => ({ ...a, read: true }))
    set({ alerts, unreadCount: 0 })
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ alerts, lastChecked: get().lastChecked }))
    }
  },

  clearAlerts: () => {
    set({ alerts: [], unreadCount: 0 })
    if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY)
  },

  setLastChecked: (lastChecked) => {
    set({ lastChecked })
    if (typeof window !== "undefined") {
      const cur = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...cur, lastChecked }))
    }
  },

  setMonitoring: (isMonitoring) => set({ isMonitoring }),
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  setWatchlistScans: (scans) => set(s => ({ watchlistScans: { ...s.watchlistScans, ...scans } })),
  setPositionRiskSignals: (signals) => set({ positionRiskSignals: signals }),
  setSoundEnabled: (soundEnabled) => {
    set({ soundEnabled })
    if (typeof window !== "undefined") {
      try { localStorage.setItem(SOUND_KEY, soundEnabled ? "1" : "0") } catch { /* ignore */ }
    }
  },

  loadFromStorage: () => {
    if (typeof window === "undefined") return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const data = JSON.parse(raw)
        const alerts = data.alerts || []
        set({
          alerts,
          lastChecked: data.lastChecked || Date.now() - 30 * 60 * 1000,
          unreadCount: alerts.filter((a: NewsAlert) => !a.read).length,
        })
      }
      const soundRaw = localStorage.getItem(SOUND_KEY)
      if (soundRaw !== null) {
        set({ soundEnabled: soundRaw === "1" })
      }
    } catch {
      // ignore
    }
  },
}))
