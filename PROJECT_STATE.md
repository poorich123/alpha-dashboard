# Alpha Dashboard — Project State

> **Purpose:** Hand-off document for continuing development in new Claude session.
> Paste this content (or reference it) when starting a fresh session.

## 🔑 URLs / Identifiers

| | Value |
|---|---|
| Production URL | `https://honkai-trader.vercel.app` |
| GitHub repo | `github.com/poorich123/alpha-dashboard` |
| Supabase project | `ggvlkxwobvopaeglancz.supabase.co` |
| Vercel project | `honkai-trader` (ipc-s-projects) |
| Local path | `C:\Users\sauen\OneDrive\เอกสาร\investing` |
| Admin user | `sauenoiss@gmail.com` (role=admin, status=approved) |

## 🏗️ Stack

- **Next.js 16** (App Router, TypeScript, Turbopack)
- **Tailwind CSS v4** + Shadcn/ui
- **Zustand** for state
- **Supabase** (Postgres + Auth + RLS)
- **Yahoo Finance** via `/api/yfinance` proxy
- **Finnhub** for quotes/news/company info
- **Claude API** via `/api/claude` (anthropic-claude-sonnet-4-5)
- **HSR character theme** (images from `enka.network/ui/hsr/SpriteOutput/`)

## 📂 Critical Files

```
src/lib/
  stockLists.ts          — 4 universes: SP500 / ETF / NYSE / SPECULATIVE
                           + SECTOR_GROUPS (mag7, semi, datacenter, defense,
                           space, pharma, energy, finance, dividend, etc.)
  marketOverview.ts      — Market scanner engine
  stockAnalyzer.ts       — TP24-style scoring + entry strategy
  yfinance.ts            — Yahoo proxy client
  finnhub.ts             — Finnhub API client
  supabaseData.ts        — Cloud sync (positions/watchlist/settings/alerts)
  supabase/client.ts     — Browser client
  supabase/server.ts     — SSR client
  marketRegime.ts        — Real-time macro regime detection
  macroRisk.ts           — Macro risk monitor
  swingScanner.ts        — Watchlist technical scoring + speculative breakdown
  newsMonitor.ts         — News alert + sentiment scoring
  backup.ts              — File-based portfolio backup
  technical.ts           — RSI/EMA/MACD/BB/Support-Resistance calculations

src/app/(app)/
  market/page.tsx        — TP24-style screener
  analyzer/page.tsx      — Stock deep-dive analyzer
  macro/page.tsx         — Macro risk dashboard
  strategy/page.tsx      — Market regime + position sizing
  news/page.tsx          — News with per-ticker grouping + sentiment
  dashboard/page.tsx     — Portfolio overview
  portfolio/page.tsx     — Portfolio CRUD
  watchlist/page.tsx     — Auto-scanned watchlist
  admin/page.tsx         — User approval (admin only)

src/components/market/   — Sparkline, IndicesBar, StockTable
src/components/analyzer/ — AnalyzerHeader, AnalyzerChart, TechnicalThesis,
                           TrendGauge, EntryStrategyCard, MarketSnapshot
src/components/hsr/      — HSRHeroBanner, characters.ts
src/middleware.ts        — Auth gate (Supabase session check)
supabase/schema.sql      — Full DB schema with RLS
```

## ✅ Phases Complete

- **Phase 1:** Authentication (Google OAuth via Supabase)
- **Phase 2:** Vercel deploy + admin approval workflow
- **Phase 3:** Cloud data sync (per-user via Supabase + RLS)
- **Phase 4:** Market screener (TP24-style with 4 categories)
- **Phase 5:** Macro Risk monitor + Strategy regime detection
- **Phase 6:** News page with per-ticker grouping + sentiment
- **Phase 7:** Sector groups from Rocket Tool reference

## 🎯 4 Market Categories

```typescript
sp500       // 500 large caps
etf         // 35 ETFs (broad + sector + thematic)
nyse        // 40 NYSE non-S&P (international ADRs)
speculative // 60 NASDAQ momentum small-mid cap
```

Each can be filtered by:
- **Signal:** All / Buy+ / Strong Buy / HIGH Conf
- **Sector:** Mag7, Semi, Data Center, Software, Defense, Space, Pharma, Energy, Finance, Dividend, Speculative, Crypto
- **Technical:** Near support, Broke resistance (uses 52w high), RSI>70, RSI<30, Above/Below EMA50

## 🐛 Known Issues / Future Work

### High Priority
- **Q5 (Alert):** Currently scans Finnhub general market news every 5 min + matches to portfolio tickers. Does NOT yet:
  - Track geopolitical events (Trump-Iran, war declarations)
  - Track commodity spikes (Brent > $120 trigger)
  - Track Fed rate decisions
  - Future: integrate dedicated macro event feeds (FRED API + news scraping)
- **Sentiment** in News uses simple keyword scoring (`quickScoreSentiment` from newsMonitor.ts). Could upgrade to Claude AI sentiment for accuracy.

### Medium Priority
- **Paper Trading** — simulated trades with $100k virtual cash
- **Trade Journal** — log + monthly review
- **Performance Report** — Monthly P&L vs SPY benchmark
- **Crypto Support** — BTC/ETH/altcoins in dedicated category
- **Email Notifications** — Resend/SendGrid for critical alerts

### Tech Debt
- `eslint` config disabled (Next.js 16 deprecated key)
- TS `ignoreBuildErrors: true` set (pre-existing Recharts type errors in some pages)
- Pre-existing TS errors in: advisor/page, analytics/page, portfolio/page (Recharts formatter types)

## 🎨 HSR Characters per Page

```
Dashboard:  Acheron     (Nihility)
Portfolio:  Seele       (Hunt)
News:       Kafka       (Nihility)
Alerts:     Kafka       (Nihility)
Advisor:    Ruan Mei    (Harmony)
Strategy:   Sparkle     (Harmony)
Analytics:  Black Swan  (Nihility)
Watchlist:  Robin       (Harmony)
Analyzer:   Jingliu     (Destruction)
Market:     Firefly     (Destruction) — swing trading vibe
Macro:      Black Swan  (Nihility)
Login:      Acheron     (background)
Pending:    Ruan Mei    (background)
```

## 🚦 Recent Bug Fixes

- ✅ Support/Resistance "broke resistance" filter showed 0 → now uses 52-week high check
- ✅ Edit Position modal didn't save → added `useEffect` form sync
- ✅ Portfolio reset on sign out → Phase 3 cloud sync fixes this
- ✅ News My Holdings showed only ticker[0] → now fetches all tickers in parallel
- ✅ Sector groups now match Rocket Tool sector lists (Nov 2026 reference)

## 🔧 Common Tasks

### Add a new sector group
Edit `src/lib/stockLists.ts` → add to `SECTOR_GROUPS`:
```typescript
sectorname: { label: "Display", emoji: "🎯", tickers: ["AAA", "BBB"] }
```

### Change category list
Edit `src/lib/stockLists.ts` → modify SP500/ETF_LIST/NYSE_INTERESTING/SPECULATIVE_MOMENTUM

### Add a new page
1. Create `src/app/(app)/<name>/page.tsx`
2. Add nav item to `src/components/layout/Sidebar.tsx`
3. Assign HSR character in `src/components/hsr/characters.ts` PAGE_CHARACTERS

### Deploy
```bash
git add -A
git commit -m "..."
git push   # Vercel auto-deploys on push to main
```

## 🧪 Testing Account

- Email: `sauenoiss@gmail.com`
- Role: admin
- Approved: yes
- Has portfolio data in Supabase

## 💡 Quick Win Ideas

1. Add "Auto-refresh Market" toggle (5/10/15 min)
2. Add Stock Comparison Tool (NVDA vs AMD side-by-side)
3. Add "Save scan as preset" (favorite filter combos)
4. Add Trade Journal (CRUD + monthly review)
5. Add Paper Trading mode ($100k virtual)
