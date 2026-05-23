/**
 * Server-Side Backup client.
 * Syncs portfolio data with disk file via /api/backup.
 *
 * This survives:
 *  - Browser clearing localStorage on close
 *  - InPrivate / private browsing mode
 *  - Edge / Chrome storage quota issues
 *  - Multiple browser profiles
 */

import type { Position, WatchlistItem, PortfolioSettings, Trade, PortfolioSnapshot } from "@/types"

export interface BackupPayload {
  positions?: Position[]
  watchlist?: WatchlistItem[]
  settings?: PortfolioSettings
  alerts?: unknown[]
  trades?: Trade[]
  snapshots?: PortfolioSnapshot[]
  savedAt?: number
}

// Debounce: avoid spamming disk on rapid state changes
let saveTimer: ReturnType<typeof setTimeout> | null = null

export async function loadBackup(): Promise<BackupPayload | null> {
  try {
    const res = await fetch("/api/backup", { cache: "no-store" })
    if (!res.ok) return null
    const body = await res.json()
    if (!body.ok || !body.data) return null
    return body.data as BackupPayload
  } catch {
    return null
  }
}

export async function saveBackup(payload: BackupPayload): Promise<boolean> {
  try {
    const res = await fetch("/api/backup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Save with debounce (default 1.5s). Use this in subscriptions.
 */
export function saveBackupDebounced(payload: BackupPayload, delayMs = 1500): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveBackup(payload).catch(() => { /* silent */ })
    saveTimer = null
  }, delayMs)
}

/**
 * Pull all data from localStorage and snapshot it into a backup payload.
 */
export function snapshotFromLocalStorage(): BackupPayload {
  if (typeof window === "undefined") return {}
  const read = <T>(key: string): T | undefined => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : undefined
    } catch {
      return undefined
    }
  }
  return {
    positions:  read<Position[]>("alpha_positions"),
    watchlist:  read<WatchlistItem[]>("alpha_watchlist"),
    settings:   read<PortfolioSettings>("alpha_settings"),
    trades:     read<Trade[]>("alpha_trades"),
    snapshots:  read<PortfolioSnapshot[]>("alpha_snapshots"),
    alerts:     (() => {
      try {
        const raw = localStorage.getItem("alpha_alerts")
        return raw ? JSON.parse(raw)?.alerts : undefined
      } catch { return undefined }
    })(),
  }
}

/**
 * Restore localStorage from a backup payload.
 * Returns count of keys restored.
 */
export function restoreToLocalStorage(payload: BackupPayload): number {
  if (typeof window === "undefined") return 0
  let count = 0
  const write = (key: string, value: unknown) => {
    if (value !== undefined && value !== null) {
      localStorage.setItem(key, JSON.stringify(value))
      count++
    }
  }
  if (payload.positions)  write("alpha_positions", payload.positions)
  if (payload.watchlist)  write("alpha_watchlist", payload.watchlist)
  if (payload.settings)   write("alpha_settings",  payload.settings)
  if (payload.trades)     write("alpha_trades",    payload.trades)
  if (payload.snapshots)  write("alpha_snapshots", payload.snapshots)
  if (payload.alerts) {
    localStorage.setItem("alpha_alerts", JSON.stringify({ alerts: payload.alerts, lastChecked: Date.now() }))
    count++
  }
  return count
}
