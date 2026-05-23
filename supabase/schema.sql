-- ═══════════════════════════════════════════════════════════════════════════
--  Alpha Dashboard — Supabase Schema
--  ────────────────────────────────────
--  Run this once in Supabase SQL Editor.
--  Tables: profiles, positions, watchlist, settings, alerts, trades, snapshots
--  Row Level Security: each user sees only their own data.
--  Admin role: can see all profiles for approval workflow.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Profiles table (extends auth.users) ────────────────────────────────

create type user_status as enum ('pending', 'approved', 'denied');
create type user_role   as enum ('admin', 'user');

create table public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  email       text not null,
  full_name   text,
  avatar_url  text,
  status      user_status not null default 'pending',
  role        user_role   not null default 'user',
  created_at  timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references public.profiles(id)
);

alter table public.profiles enable row level security;

-- Anyone authenticated can read their own profile
create policy "Users read own profile"
  on public.profiles for select
  using ( auth.uid() = id );

-- Admins can read all profiles (for approval dashboard)
create policy "Admins read all profiles"
  on public.profiles for select
  using ( exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ));

-- Admins can update any profile (approve/deny)
create policy "Admins update profiles"
  on public.profiles for update
  using ( exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ));

-- Users can update their own profile (name, avatar)
create policy "Users update own profile"
  on public.profiles for update
  using ( auth.uid() = id );

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── 2. Helper: must be approved + own_data check ──────────────────────────

create or replace function public.is_approved()
returns boolean
language sql
security definer
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'approved'
  );
$$;

-- ─── 3. Positions table ────────────────────────────────────────────────────

create table public.positions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  ticker       text not null,
  company_name text not null,
  logo_url     text,
  category     text not null default 'core',
  shares       numeric not null default 0,
  avg_cost     numeric not null default 0,
  current_price numeric not null default 0,
  target_price numeric not null default 0,
  stop_loss    numeric not null default 0,
  currency     text not null default 'USD',
  exchange     text not null default 'NASDAQ',
  sector       text,
  thesis       text,
  entry_date   date,
  tags         text[] default '{}',
  notes        text,
  is_active    boolean not null default true,
  alert_enabled boolean not null default true,
  high52w      numeric,
  low52w       numeric,
  pe_ratio     numeric,
  market_cap   numeric,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_positions_user on public.positions(user_id);
create index idx_positions_ticker on public.positions(user_id, ticker);

alter table public.positions enable row level security;

create policy "Users CRUD own positions"
  on public.positions for all
  using ( auth.uid() = user_id and public.is_approved() )
  with check ( auth.uid() = user_id and public.is_approved() );

-- ─── 4. Watchlist table ────────────────────────────────────────────────────

create table public.watchlist (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  ticker          text not null,
  company_name    text not null,
  logo_url        text,
  entry_zone_low  numeric default 0,
  entry_zone_high numeric default 0,
  target_price    numeric default 0,
  stop_loss       numeric default 0,
  thesis          text,
  priority        text default 'medium',
  notes           text,
  added_date      date default current_date,
  sector          text,
  current_price   numeric,
  days_to_earnings int,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_watchlist_user on public.watchlist(user_id);

alter table public.watchlist enable row level security;

create policy "Users CRUD own watchlist"
  on public.watchlist for all
  using ( auth.uid() = user_id and public.is_approved() )
  with check ( auth.uid() = user_id and public.is_approved() );

-- ─── 5. Settings table (1 row per user, JSON for flexibility) ─────────────

create table public.settings (
  user_id    uuid references auth.users(id) on delete cascade primary key,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;

create policy "Users CRUD own settings"
  on public.settings for all
  using ( auth.uid() = user_id and public.is_approved() )
  with check ( auth.uid() = user_id and public.is_approved() );

-- ─── 6. Alerts (news alerts) ───────────────────────────────────────────────

create table public.alerts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  data       jsonb not null,
  timestamp  bigint not null,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_alerts_user_time on public.alerts(user_id, timestamp desc);

alter table public.alerts enable row level security;

create policy "Users CRUD own alerts"
  on public.alerts for all
  using ( auth.uid() = user_id and public.is_approved() )
  with check ( auth.uid() = user_id and public.is_approved() );

-- ─── 7. Trades log ─────────────────────────────────────────────────────────

create table public.trades (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  ticker       text not null,
  action       text not null check (action in ('buy', 'sell')),
  shares       numeric not null,
  price        numeric not null,
  trade_date   date not null,
  notes        text,
  realized_pnl numeric,
  created_at   timestamptz not null default now()
);

create index idx_trades_user_date on public.trades(user_id, trade_date desc);

alter table public.trades enable row level security;

create policy "Users CRUD own trades"
  on public.trades for all
  using ( auth.uid() = user_id and public.is_approved() )
  with check ( auth.uid() = user_id and public.is_approved() );

-- ─── 8. Portfolio Snapshots (historical) ───────────────────────────────────

create table public.snapshots (
  user_id    uuid references auth.users(id) on delete cascade not null,
  snap_date  date not null,
  total_value numeric not null,
  cash_usd   numeric not null,
  sp500      numeric,
  nasdaq     numeric,
  primary key (user_id, snap_date)
);

alter table public.snapshots enable row level security;

create policy "Users CRUD own snapshots"
  on public.snapshots for all
  using ( auth.uid() = user_id and public.is_approved() )
  with check ( auth.uid() = user_id and public.is_approved() );

-- ─── 9. Updated_at trigger (auto-touch on update) ──────────────────────────

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger positions_updated_at  before update on public.positions  for each row execute function public.touch_updated_at();
create trigger watchlist_updated_at  before update on public.watchlist  for each row execute function public.touch_updated_at();
create trigger settings_updated_at   before update on public.settings   for each row execute function public.touch_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
--  After running this, manually promote yourself to admin:
--
--     update public.profiles
--     set role = 'admin', status = 'approved'
--     where email = 'YOUR_EMAIL@example.com';
--
-- ═══════════════════════════════════════════════════════════════════════════
