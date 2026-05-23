import { create } from "zustand"
import type { Position, WatchlistItem, PortfolioSettings, PortfolioStats, ChatMessage } from "@/types"
import { saveBackupDebounced, snapshotFromLocalStorage } from "@/lib/backup"
import {
  getPositions,
  savePositions,
  getWatchlist,
  saveWatchlist,
  getSettings,
  saveSettings,
  calculatePortfolioStats,
  DEFAULT_SETTINGS,
} from "@/lib/portfolio"

interface PortfolioStore {
  positions: Position[]
  watchlist: WatchlistItem[]
  settings: PortfolioSettings
  stats: PortfolioStats | null
  usdThbRate: number
  lastUpdated: Date | null
  isLoading: boolean
  chatMessages: ChatMessage[]
  isDemoMode: boolean

  loadFromStorage: () => void
  setPositions: (positions: Position[]) => void
  addPosition: (position: Position) => void
  updatePosition: (id: string, updates: Partial<Position>) => void
  deletePosition: (id: string) => void
  setWatchlist: (watchlist: WatchlistItem[]) => void
  updateSettings: (settings: Partial<PortfolioSettings>) => void
  setUsdThbRate: (rate: number) => void
  refreshStats: () => void
  setLoading: (loading: boolean) => void
  addChatMessage: (message: ChatMessage) => void
  clearChat: () => void
  setDemoMode: (demo: boolean) => void
}

export const usePortfolioStore = create<PortfolioStore>((set, get) => {
  // ── Auto-save guard ──
  // Subscribe to state changes and persist positions/watchlist/settings
  // any time they mutate (defensive — protects against direct .setState() calls
  // that bypass the action methods).
  if (typeof window !== "undefined") {
    let lastPositionsRef: Position[] | null = null
    let lastWatchlistRef: WatchlistItem[] | null = null
    let lastSettingsRef: PortfolioSettings | null = null

    setTimeout(() => {
      usePortfolioStore.subscribe((state) => {
        let changed = false
        if (state.positions !== lastPositionsRef && state.positions.length > 0) {
          lastPositionsRef = state.positions
          savePositions(state.positions)
          changed = true
        }
        if (state.watchlist !== lastWatchlistRef) {
          lastWatchlistRef = state.watchlist
          saveWatchlist(state.watchlist)
          changed = true
        }
        if (state.settings !== lastSettingsRef) {
          lastSettingsRef = state.settings
          saveSettings(state.settings)
          changed = true
        }
        // ── Server-side backup (debounced) ──
        // Mirror all data to disk file so it survives localStorage clearing.
        if (changed) {
          saveBackupDebounced(snapshotFromLocalStorage())
        }
      })
    }, 0)
  }

  return {
  positions: [],
  watchlist: [],
  settings: DEFAULT_SETTINGS,
  stats: null,
  usdThbRate: 35.5,
  lastUpdated: null,
  isLoading: false,
  chatMessages: [],
  isDemoMode: false,

  loadFromStorage: () => {
    const positions = getPositions()
    const watchlist = getWatchlist()
    const settings = getSettings()
    set({ positions, watchlist, settings })
    const stats = calculatePortfolioStats(positions, settings.totalCashUSD, get().usdThbRate)
    set({ stats, lastUpdated: new Date() })
  },

  setPositions: (positions) => {
    savePositions(positions)
    set({ positions })
    const { settings, usdThbRate } = get()
    const stats = calculatePortfolioStats(positions, settings.totalCashUSD, usdThbRate)
    set({ stats, lastUpdated: new Date() })
  },

  addPosition: (position) => {
    const positions = [...get().positions, position]
    savePositions(positions)
    set({ positions })
    const { settings, usdThbRate } = get()
    const stats = calculatePortfolioStats(positions, settings.totalCashUSD, usdThbRate)
    set({ stats, lastUpdated: new Date() })
  },

  updatePosition: (id, updates) => {
    const positions = get().positions.map((p) => (p.id === id ? { ...p, ...updates } : p))
    savePositions(positions)
    set({ positions })
    const { settings, usdThbRate } = get()
    const stats = calculatePortfolioStats(positions, settings.totalCashUSD, usdThbRate)
    set({ stats, lastUpdated: new Date() })
  },

  deletePosition: (id) => {
    const positions = get().positions.filter((p) => p.id !== id)
    savePositions(positions)
    set({ positions })
    const { settings, usdThbRate } = get()
    const stats = calculatePortfolioStats(positions, settings.totalCashUSD, usdThbRate)
    set({ stats, lastUpdated: new Date() })
  },

  setWatchlist: (watchlist) => {
    saveWatchlist(watchlist)
    set({ watchlist })
  },

  updateSettings: (updates) => {
    const settings = { ...get().settings, ...updates }
    saveSettings(settings)
    set({ settings })
    const { positions, usdThbRate } = get()
    const stats = calculatePortfolioStats(positions, settings.totalCashUSD, usdThbRate)
    set({ stats })
  },

  setUsdThbRate: (rate) => {
    set({ usdThbRate: rate })
    const { positions, settings } = get()
    const stats = calculatePortfolioStats(positions, settings.totalCashUSD, rate)
    set({ stats })
  },

  refreshStats: () => {
    const { positions, settings, usdThbRate } = get()
    const stats = calculatePortfolioStats(positions, settings.totalCashUSD, usdThbRate)
    set({ stats, lastUpdated: new Date() })
  },

  setLoading: (isLoading) => set({ isLoading }),

  addChatMessage: (message) => {
    const messages = [...get().chatMessages, message]
    set({ chatMessages: messages })
    if (typeof window !== "undefined") {
      localStorage.setItem("alpha_chat", JSON.stringify(messages.slice(-50)))
    }
  },

  clearChat: () => {
    set({ chatMessages: [] })
    if (typeof window !== "undefined") {
      localStorage.removeItem("alpha_chat")
    }
  },

  setDemoMode: (isDemoMode) => set({ isDemoMode }),
  }
})
