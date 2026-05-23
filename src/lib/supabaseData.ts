/**
 * Supabase Data Sync Layer
 * ─────────────────────────
 * Syncs portfolio/watchlist/settings between Zustand store and Supabase Postgres.
 *
 * Flow:
 *   - On user login → fetchAllFromCloud → populate store + localStorage cache
 *   - On store change → syncToCloud (debounced) → upsert to Supabase
 *   - On first-time login with localStorage data but no cloud data → migrate
 *
 * Falls back gracefully when Supabase isn't configured (local-only mode).
 */

import { getSupabaseBrowser, hasSupabaseConfigured } from "./supabase/client"
import type { Position, WatchlistItem, PortfolioSettings } from "@/types"

// ─── Type translation ────────────────────────────────────────────────────────
// Position (app) → positions row (DB)

function positionToRow(p: Position, userId: string) {
  return {
    id: p.id,
    user_id: userId,
    ticker: p.ticker,
    company_name: p.companyName,
    logo_url: p.logoUrl || null,
    category: p.category,
    shares: p.shares,
    avg_cost: p.avgCost,
    current_price: p.currentPrice,
    target_price: p.targetPrice,
    stop_loss: p.stopLoss,
    currency: p.currency,
    exchange: p.exchange,
    sector: p.sector || null,
    thesis: p.thesis || null,
    entry_date: p.entryDate || null,
    tags: p.tags || [],
    notes: p.notes || null,
    is_active: p.isActive,
    alert_enabled: p.alertEnabled,
    high52w: p.high52w || null,
    low52w: p.low52w || null,
    pe_ratio: p.peRatio || null,
    market_cap: p.marketCap || null,
  }
}

function rowToPosition(r: Record<string, unknown>): Position {
  return {
    id: r.id as string,
    ticker: r.ticker as string,
    companyName: (r.company_name as string) || "",
    logoUrl: (r.logo_url as string) || "",
    category: (r.category as Position["category"]) || "core",
    shares: Number(r.shares) || 0,
    avgCost: Number(r.avg_cost) || 0,
    currentPrice: Number(r.current_price) || 0,
    targetPrice: Number(r.target_price) || 0,
    stopLoss: Number(r.stop_loss) || 0,
    currency: "USD",
    exchange: (r.exchange as string) || "NASDAQ",
    sector: (r.sector as string) || "",
    thesis: (r.thesis as string) || "",
    entryDate: (r.entry_date as string) || "",
    tags: (r.tags as string[]) || [],
    notes: (r.notes as string) || "",
    isActive: r.is_active !== false,
    alertEnabled: r.alert_enabled !== false,
    high52w: r.high52w as number | undefined,
    low52w: r.low52w as number | undefined,
    peRatio: r.pe_ratio as number | undefined,
    marketCap: r.market_cap as number | undefined,
  }
}

function watchlistToRow(w: WatchlistItem, userId: string) {
  return {
    id: w.id,
    user_id: userId,
    ticker: w.ticker,
    company_name: w.companyName,
    logo_url: w.logoUrl || null,
    entry_zone_low: w.entryZoneLow,
    entry_zone_high: w.entryZoneHigh,
    target_price: w.targetPrice,
    stop_loss: w.stopLoss,
    thesis: w.thesis || null,
    priority: w.priority,
    notes: w.notes || null,
    added_date: w.addedDate,
    sector: w.sector || null,
    current_price: w.currentPrice || null,
    days_to_earnings: w.daysToEarnings || null,
  }
}

function rowToWatchlist(r: Record<string, unknown>): WatchlistItem {
  return {
    id: r.id as string,
    ticker: r.ticker as string,
    companyName: (r.company_name as string) || "",
    logoUrl: (r.logo_url as string) || "",
    entryZoneLow: Number(r.entry_zone_low) || 0,
    entryZoneHigh: Number(r.entry_zone_high) || 0,
    targetPrice: Number(r.target_price) || 0,
    stopLoss: Number(r.stop_loss) || 0,
    thesis: (r.thesis as string) || "",
    priority: (r.priority as WatchlistItem["priority"]) || "medium",
    notes: (r.notes as string) || "",
    addedDate: (r.added_date as string) || new Date().toISOString().split("T")[0],
    sector: (r.sector as string) || "",
    currentPrice: r.current_price as number | undefined,
    daysToEarnings: r.days_to_earnings as number | undefined,
  }
}

// ─── Get current user (cached per call) ──────────────────────────────────────

export async function getCurrentUserId(): Promise<string | null> {
  if (!hasSupabaseConfigured()) return null
  try {
    const supabase = getSupabaseBrowser()
    const { data } = await supabase.auth.getUser()
    return data.user?.id || null
  } catch {
    return null
  }
}

// ─── Fetch all data from cloud ───────────────────────────────────────────────

export interface CloudData {
  positions: Position[]
  watchlist: WatchlistItem[]
  settings: PortfolioSettings | null
}

export async function fetchAllFromCloud(userId: string): Promise<CloudData> {
  const supabase = getSupabaseBrowser()

  const [posRes, wlRes, setRes] = await Promise.all([
    supabase.from("positions").select("*").eq("user_id", userId),
    supabase.from("watchlist").select("*").eq("user_id", userId),
    supabase.from("settings").select("data").eq("user_id", userId).maybeSingle(),
  ])

  return {
    positions: (posRes.data || []).map(rowToPosition),
    watchlist: (wlRes.data || []).map(rowToWatchlist),
    settings: (setRes.data?.data as PortfolioSettings) || null,
  }
}

// ─── Save individual items ───────────────────────────────────────────────────

export async function upsertPositionCloud(p: Position, userId: string): Promise<void> {
  const supabase = getSupabaseBrowser()
  const { error } = await supabase.from("positions").upsert(positionToRow(p, userId))
  if (error) throw error
}

export async function deletePositionCloud(positionId: string, userId: string): Promise<void> {
  const supabase = getSupabaseBrowser()
  const { error } = await supabase.from("positions").delete().eq("id", positionId).eq("user_id", userId)
  if (error) throw error
}

export async function upsertWatchlistCloud(w: WatchlistItem, userId: string): Promise<void> {
  const supabase = getSupabaseBrowser()
  const { error } = await supabase.from("watchlist").upsert(watchlistToRow(w, userId))
  if (error) throw error
}

export async function deleteWatchlistCloud(id: string, userId: string): Promise<void> {
  const supabase = getSupabaseBrowser()
  const { error } = await supabase.from("watchlist").delete().eq("id", id).eq("user_id", userId)
  if (error) throw error
}

export async function saveSettingsCloud(settings: PortfolioSettings, userId: string): Promise<void> {
  const supabase = getSupabaseBrowser()
  const { error } = await supabase.from("settings").upsert({
    user_id: userId,
    data: settings as unknown as Record<string, unknown>,
  })
  if (error) throw error
}

// ─── Bulk sync entire state ──────────────────────────────────────────────────

interface SyncState {
  positions: Position[]
  watchlist: WatchlistItem[]
  settings: PortfolioSettings
}

let syncTimer: ReturnType<typeof setTimeout> | null = null
let lastSyncedPositions: Position[] | null = null
let lastSyncedWatchlist: WatchlistItem[] | null = null
let lastSyncedSettings: PortfolioSettings | null = null

export function syncToCloudDebounced(state: SyncState, userId: string, delayMs = 1500): void {
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(async () => {
    try {
      await syncToCloud(state, userId)
    } catch (err) {
      console.error("[supabaseData] sync failed:", err)
    }
    syncTimer = null
  }, delayMs)
}

export async function syncToCloud(state: SyncState, userId: string): Promise<void> {
  const supabase = getSupabaseBrowser()

  // Positions: detect changes and upsert
  if (state.positions !== lastSyncedPositions) {
    const rows = state.positions.map(p => positionToRow(p, userId))
    if (rows.length > 0) {
      const { error } = await supabase.from("positions").upsert(rows)
      if (error) console.error("[sync] positions:", error)
    }

    // Delete positions that exist in cloud but not in local state
    if (lastSyncedPositions) {
      const currentIds = new Set(state.positions.map(p => p.id))
      const toDelete = lastSyncedPositions.filter(p => !currentIds.has(p.id)).map(p => p.id)
      if (toDelete.length > 0) {
        await supabase.from("positions").delete().in("id", toDelete).eq("user_id", userId)
      }
    }
    lastSyncedPositions = state.positions
  }

  // Watchlist
  if (state.watchlist !== lastSyncedWatchlist) {
    const rows = state.watchlist.map(w => watchlistToRow(w, userId))
    if (rows.length > 0) {
      const { error } = await supabase.from("watchlist").upsert(rows)
      if (error) console.error("[sync] watchlist:", error)
    }
    if (lastSyncedWatchlist) {
      const currentIds = new Set(state.watchlist.map(w => w.id))
      const toDelete = lastSyncedWatchlist.filter(w => !currentIds.has(w.id)).map(w => w.id)
      if (toDelete.length > 0) {
        await supabase.from("watchlist").delete().in("id", toDelete).eq("user_id", userId)
      }
    }
    lastSyncedWatchlist = state.watchlist
  }

  // Settings (single row per user, store as jsonb)
  if (state.settings !== lastSyncedSettings) {
    await saveSettingsCloud(state.settings, userId)
    lastSyncedSettings = state.settings
  }
}

// ─── Set baselines after fetch — avoid re-syncing on initial load ────────────

export function setSyncBaseline(state: Partial<SyncState>): void {
  if (state.positions !== undefined) lastSyncedPositions = state.positions
  if (state.watchlist !== undefined) lastSyncedWatchlist = state.watchlist
  if (state.settings  !== undefined) lastSyncedSettings  = state.settings
}

// ─── One-time migration: localStorage → Supabase ────────────────────────────

export async function migrateLocalToCloud(userId: string): Promise<{ pushed: number }> {
  if (typeof window === "undefined") return { pushed: 0 }

  let pushed = 0
  try {
    // Positions
    const posRaw = localStorage.getItem("alpha_positions")
    if (posRaw) {
      const positions = JSON.parse(posRaw) as Position[]
      if (Array.isArray(positions) && positions.length > 0) {
        await syncToCloud({
          positions,
          watchlist: [],
          settings: {} as PortfolioSettings,
        }, userId)
        pushed += positions.length
      }
    }

    // Watchlist
    const wlRaw = localStorage.getItem("alpha_watchlist")
    if (wlRaw) {
      const watchlist = JSON.parse(wlRaw) as WatchlistItem[]
      if (Array.isArray(watchlist) && watchlist.length > 0) {
        const supabase = getSupabaseBrowser()
        const rows = watchlist.map(w => watchlistToRow(w, userId))
        await supabase.from("watchlist").upsert(rows)
        pushed += watchlist.length
      }
    }

    // Settings
    const setRaw = localStorage.getItem("alpha_settings")
    if (setRaw) {
      const settings = JSON.parse(setRaw) as PortfolioSettings
      await saveSettingsCloud(settings, userId)
      pushed += 1
    }
  } catch (err) {
    console.error("[migrate]", err)
  }

  return { pushed }
}
