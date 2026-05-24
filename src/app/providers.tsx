"use client"

import { Toaster } from "react-hot-toast"
import { useEffect } from "react"
import { usePortfolioStore } from "@/store/portfolioStore"
import { useAlertStore } from "@/store/alertStore"
import { getUsdThbRate } from "@/lib/finnhub"
import { isOnboarded, setOnboarded, savePositions, saveWatchlist, saveSettings } from "@/lib/portfolio"
import { checkForAlerts, checkForMacroAlerts } from "@/lib/newsMonitor"
import { runWatchlistScan, runSpeculativeScan } from "@/lib/swingScanner"
import { loadBackup, restoreToLocalStorage } from "@/lib/backup"
import { hasSupabaseConfigured, getSupabaseBrowser } from "@/lib/supabase/client"
import {
  fetchAllFromCloud,
  syncToCloudDebounced,
  setSyncBaseline,
  migrateLocalToCloud,
  getCurrentUserId,
} from "@/lib/supabaseData"
import { useRouter, usePathname } from "next/navigation"
import toast from "react-hot-toast"

const MONITOR_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

function StoreInitializer() {
  const { loadFromStorage, setUsdThbRate, positions } = usePortfolioStore()
  const { loadFromStorage: loadAlerts, addAlert, setLastChecked, setMonitoring, lastChecked } = useAlertStore()
  const router = useRouter()
  const pathname = usePathname()

  // Apply cloud data: populate store + cache to localStorage + set sync baseline
  function applyCloudData(cloud: { positions: import("@/types").Position[]; watchlist: import("@/types").WatchlistItem[]; settings: import("@/types").PortfolioSettings | null }) {
    // Cache to localStorage for offline / fast subsequent loads
    if (cloud.positions.length > 0) {
      savePositions(cloud.positions)
    }
    if (cloud.watchlist.length > 0) {
      saveWatchlist(cloud.watchlist)
    }
    if (cloud.settings) {
      saveSettings(cloud.settings)
    }
    // Load into Zustand store
    loadFromStorage()
    // Set baseline so we don't re-sync the same data right back to cloud
    setSyncBaseline({
      positions: cloud.positions,
      watchlist: cloud.watchlist,
      settings: cloud.settings || undefined,
    })
  }

  // One-time initialization
  useEffect(() => {
    let cancelled = false

    async function init() {
      // ── Step 1: Check Supabase user (if configured) ──
      const userId = hasSupabaseConfigured() ? await getCurrentUserId() : null

      if (userId) {
        // ── Cloud mode: fetch user's data from Supabase ─────────────────
        try {
          const cloud = await fetchAllFromCloud(userId)

          // If user has localStorage data but cloud is empty → migrate
          const hasLocalData = !!localStorage.getItem("alpha_positions")
                           || !!localStorage.getItem("alpha_watchlist")
          if (cloud.positions.length === 0 && cloud.watchlist.length === 0 && hasLocalData) {
            const result = await migrateLocalToCloud(userId)
            if (result.pushed > 0) {
              toast.success(`Migrated ${result.pushed} items to cloud`, { duration: 3000 })
              // Re-fetch after migration
              const fresh = await fetchAllFromCloud(userId)
              applyCloudData(fresh)
            } else {
              applyCloudData(cloud)
            }
          } else {
            applyCloudData(cloud)
          }
          setOnboarded()
        } catch (err) {
          console.error("[cloud init] failed:", err)
          toast.error("Cloud sync failed — using local data")
          loadFromStorage()
        }
      } else {
        // ── Local-only mode: localStorage + backup file ─────────────────
        const hasLocalData = !!localStorage.getItem("alpha_positions")
                         || !!localStorage.getItem("alpha_settings")
        if (!hasLocalData) {
          try {
            const backup = await loadBackup()
            if (!cancelled && backup) {
              const restored = restoreToLocalStorage(backup)
              if (restored > 0) {
                toast.success(`Restored ${restored} data sets from backup`, { duration: 4000 })
                setOnboarded()
              }
            }
          } catch { /* ignore */ }
        }
        if (cancelled) return
        loadFromStorage()
      }

      loadAlerts()

      // Load chat from localStorage
      const savedChat = localStorage.getItem("alpha_chat")
      if (savedChat) {
        try {
          const messages = JSON.parse(savedChat)
          usePortfolioStore.setState({ chatMessages: messages })
        } catch { /* ignore */ }
      }

      // Fetch exchange rate
      getUsdThbRate().then(setUsdThbRate).catch(() => {})

      // Redirect to onboarding if needed (only in local-only mode)
      if (!hasSupabaseConfigured() && !isOnboarded() && pathname !== "/onboarding") {
        router.replace("/onboarding")
      }
    }

    init()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to portfolio store → auto-sync to Supabase when user is logged in
  useEffect(() => {
    if (!hasSupabaseConfigured()) return

    let userId: string | null = null
    let cancelled = false

    // Get user ID once
    getCurrentUserId().then(id => {
      if (!cancelled) userId = id
    })

    // Subscribe to all state changes
    const unsubscribe = usePortfolioStore.subscribe((state) => {
      if (!userId) return
      // Skip initial empty state
      if (state.positions.length === 0 && state.watchlist.length === 0) return

      syncToCloudDebounced({
        positions: state.positions,
        watchlist: state.watchlist,
        settings: state.settings,
      }, userId, 1500)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  // News monitoring loop — runs every 5 minutes
  useEffect(() => {
    // Don't monitor on onboarding page
    if (pathname === "/onboarding") return

    let cancelled = false

    async function runCheck() {
      const currentPositions = usePortfolioStore.getState().positions

      const { lastChecked, watchlistScans, addAlert, setLastChecked, setWatchlistScans } = useAlertStore.getState()
      const watchlist = currentPositions.filter(p => p.category === "watchlist")
      const speculative = currentPositions.filter(p => p.isActive && p.category === "speculative")

      // ── 1a. Macro alerts (run always — independent of portfolio) ────────
      try {
        const macroAlerts = await checkForMacroAlerts(lastChecked)
        if (!cancelled) {
          for (const alert of macroAlerts) addAlert(alert)
        }
      } catch { /* ignore */ }

      if (cancelled) return

      // ── 1b. Portfolio news alerts (skip if empty portfolio) ─────────────
      if (currentPositions.length > 0) {
        try {
          const newAlerts = await checkForAlerts(currentPositions, lastChecked)
          if (!cancelled) {
            for (const alert of newAlerts) addAlert(alert)
          }
        } catch { /* ignore */ }
      }
      setLastChecked(Date.now())

      if (cancelled) return
      if (currentPositions.length === 0) return  // skip ticker scans if empty

      // ── 2. Watchlist technical scan ────────────────────────────────────
      if (watchlist.length > 0) {
        try {
          // Map watchlist positions to WatchlistItem-like objects
          const watchlistItems = watchlist.map(p => ({
            id: p.id, ticker: p.ticker, companyName: p.companyName,
            logoUrl: p.logoUrl, entryZoneLow: 0, entryZoneHigh: 0,
            targetPrice: p.targetPrice, stopLoss: p.stopLoss,
            thesis: p.thesis, priority: "medium" as const,
            notes: p.notes, addedDate: p.entryDate, sector: p.sector,
            currentPrice: p.currentPrice,
          }))
          const scans = await runWatchlistScan(watchlistItems)
          if (!cancelled) setWatchlistScans(scans)
        } catch { /* ignore */ }
      }

      if (cancelled) return

      // ── 3. Speculative position breakdown scan ─────────────────────────
      if (speculative.length > 0) {
        try {
          const breakdownAlerts = await runSpeculativeScan(speculative, watchlistScans)
          if (!cancelled) {
            for (const alert of breakdownAlerts) addAlert(alert)
          }
        } catch { /* ignore */ }
      }
    }

    // Start monitoring
    setMonitoring(true)

    // Initial check after a short delay (let data load first)
    const initialDelay = setTimeout(() => {
      if (!cancelled) runCheck()
    }, 8000)

    // Recurring interval
    const interval = setInterval(() => {
      if (!cancelled) runCheck()
    }, MONITOR_INTERVAL_MS)

    return () => {
      cancelled = true
      clearTimeout(initialDelay)
      clearInterval(interval)
      setMonitoring(false)
    }
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StoreInitializer />
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#0C1628",
            color: "#f9fafb",
            border: "1px solid #1A2E52",
          },
          success: {
            iconTheme: { primary: "#22c55e", secondary: "#0C1628" },
          },
          error: {
            iconTheme: { primary: "#ef4444", secondary: "#0C1628" },
          },
        }}
      />
    </>
  )
}
