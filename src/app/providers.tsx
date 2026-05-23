"use client"

import { Toaster } from "react-hot-toast"
import { useEffect } from "react"
import { usePortfolioStore } from "@/store/portfolioStore"
import { useAlertStore } from "@/store/alertStore"
import { getUsdThbRate } from "@/lib/finnhub"
import { isOnboarded, setOnboarded } from "@/lib/portfolio"
import { checkForAlerts } from "@/lib/newsMonitor"
import { runWatchlistScan, runSpeculativeScan } from "@/lib/swingScanner"
import { loadBackup, restoreToLocalStorage } from "@/lib/backup"
import { useRouter, usePathname } from "next/navigation"
import toast from "react-hot-toast"

const MONITOR_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

function StoreInitializer() {
  const { loadFromStorage, setUsdThbRate, positions } = usePortfolioStore()
  const { loadFromStorage: loadAlerts, addAlert, setLastChecked, setMonitoring, lastChecked } = useAlertStore()
  const router = useRouter()
  const pathname = usePathname()

  // One-time initialization
  useEffect(() => {
    let cancelled = false

    async function init() {
      // ── Step 1: Check if localStorage has data ──
      const hasLocalData = !!localStorage.getItem("alpha_positions")
                       || !!localStorage.getItem("alpha_settings")

      // ── Step 2: If localStorage is empty, try restoring from server backup ──
      if (!hasLocalData) {
        try {
          const backup = await loadBackup()
          if (!cancelled && backup) {
            const restored = restoreToLocalStorage(backup)
            if (restored > 0) {
              toast.success(`Restored ${restored} data sets from backup`, { duration: 4000 })
              // Mark as onboarded so we don't redirect them
              setOnboarded()
            }
          }
        } catch {
          // backup unavailable — fall through to localStorage (empty)
        }
      }

      if (cancelled) return

      // ── Step 3: Normal load from localStorage ──
      loadFromStorage()
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

      // Redirect to onboarding if needed
      if (!isOnboarded() && pathname !== "/onboarding") {
        router.replace("/onboarding")
      }
    }

    init()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // News monitoring loop — runs every 5 minutes
  useEffect(() => {
    // Don't monitor on onboarding page
    if (pathname === "/onboarding") return

    let cancelled = false

    async function runCheck() {
      const currentPositions = usePortfolioStore.getState().positions
      if (currentPositions.length === 0) return

      const { lastChecked, watchlistScans, addAlert, setLastChecked, setWatchlistScans } = useAlertStore.getState()
      const watchlist = currentPositions.filter(p => p.category === "watchlist")
      const speculative = currentPositions.filter(p => p.isActive && p.category === "speculative")

      // ── 1. News alerts ─────────────────────────────────────────────────
      try {
        const newAlerts = await checkForAlerts(currentPositions, lastChecked)
        if (!cancelled) {
          for (const alert of newAlerts) addAlert(alert)
          setLastChecked(Date.now())
        }
      } catch { /* ignore */ }

      if (cancelled) return

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
