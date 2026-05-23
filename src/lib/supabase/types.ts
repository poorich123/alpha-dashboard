/**
 * Supabase generated types.
 * Matches schema.sql.
 *
 * Tip: regenerate from CLI later with:
 *   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/supabase/types.ts
 */

export type UserStatus = "pending" | "approved" | "denied"
export type UserRole = "admin" | "user"

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  status: UserStatus
  role: UserRole
  created_at: string
  approved_at: string | null
  approved_by: string | null
}

export interface PositionRow {
  id: string
  user_id: string
  ticker: string
  company_name: string
  logo_url: string | null
  category: string
  shares: number
  avg_cost: number
  current_price: number
  target_price: number
  stop_loss: number
  currency: string
  exchange: string
  sector: string | null
  thesis: string | null
  entry_date: string | null
  tags: string[]
  notes: string | null
  is_active: boolean
  alert_enabled: boolean
  high52w: number | null
  low52w: number | null
  pe_ratio: number | null
  market_cap: number | null
  created_at: string
  updated_at: string
}

export interface WatchlistRow {
  id: string
  user_id: string
  ticker: string
  company_name: string
  logo_url: string | null
  entry_zone_low: number
  entry_zone_high: number
  target_price: number
  stop_loss: number
  thesis: string | null
  priority: string
  notes: string | null
  added_date: string
  sector: string | null
  current_price: number | null
  days_to_earnings: number | null
  created_at: string
  updated_at: string
}

export interface SettingsRow {
  user_id: string
  data: Record<string, unknown>
  updated_at: string
}

export interface AlertRow {
  id: string
  user_id: string
  data: Record<string, unknown>
  timestamp: number
  is_read: boolean
  created_at: string
}

export interface TradeRow {
  id: string
  user_id: string
  ticker: string
  action: "buy" | "sell"
  shares: number
  price: number
  trade_date: string
  notes: string | null
  realized_pnl: number | null
  created_at: string
}

export interface SnapshotRow {
  user_id: string
  snap_date: string
  total_value: number
  cash_usd: number
  sp500: number | null
  nasdaq: number | null
}

export type Database = {
  public: {
    Tables: {
      profiles:  { Row: Profile;      Insert: Partial<Profile>;      Update: Partial<Profile>;      Relationships: [] }
      positions: { Row: PositionRow;  Insert: Partial<PositionRow>;  Update: Partial<PositionRow>;  Relationships: [] }
      watchlist: { Row: WatchlistRow; Insert: Partial<WatchlistRow>; Update: Partial<WatchlistRow>; Relationships: [] }
      settings:  { Row: SettingsRow;  Insert: Partial<SettingsRow>;  Update: Partial<SettingsRow>;  Relationships: [] }
      alerts:    { Row: AlertRow;     Insert: Partial<AlertRow>;     Update: Partial<AlertRow>;     Relationships: [] }
      trades:    { Row: TradeRow;     Insert: Partial<TradeRow>;     Update: Partial<TradeRow>;     Relationships: [] }
      snapshots: { Row: SnapshotRow;  Insert: Partial<SnapshotRow>;  Update: Partial<SnapshotRow>;  Relationships: [] }
    }
    Views: { [key: string]: never }
    Functions: { [key: string]: never }
    Enums: {
      user_status: UserStatus
      user_role:   UserRole
    }
    CompositeTypes: { [key: string]: never }
  }
}
