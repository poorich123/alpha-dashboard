# 🌐 Alpha Dashboard — Cloud Setup Guide

Deploy Alpha Dashboard to the internet with Supabase + Vercel · Google login + admin approval workflow

---

## 📋 What You'll End Up With

```
URL: https://alpha-dashboard.vercel.app   (or your custom domain)
Login: Google OAuth (one-click)
Storage: Supabase Postgres (500MB free)
Permission: Manual approval by admin (you)
Hosting: Vercel (free tier, generous)
```

**Cost: $0/month** for up to ~50 users

---

## 🚀 Step-by-Step Setup (45 minutes total)

### Step 1: Create Supabase Project (5 min)

1. Go to [supabase.com](https://supabase.com) → **Start your project** → sign in with GitHub
2. Click **New Project**
3. Fill in:
   - **Name:** `alpha-dashboard`
   - **Database Password:** generate strong password → **save it!**
   - **Region:** `Southeast Asia (Singapore)` (closest to Thailand)
   - **Plan:** Free
4. Wait ~2 minutes for project to provision

### Step 2: Run the Schema (2 min)

1. In Supabase dashboard → left sidebar → **SQL Editor**
2. Click **New query**
3. Open `supabase/schema.sql` in your editor → copy all
4. Paste in Supabase SQL Editor → click **Run** (or Ctrl+Enter)
5. Should see `Success. No rows returned.`

### Step 3: Configure Google OAuth (10 min)

#### 3a. Create Google OAuth credentials

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create new project (or use existing) — name: `alpha-dashboard`
3. **APIs & Services** → **OAuth consent screen**
   - User Type: **External**
   - App name: `Alpha Dashboard`
   - User support email: your email
   - Save & Continue (skip the rest for now)
4. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**
   - Application type: **Web application**
   - Name: `Alpha Dashboard Web`
   - **Authorized JavaScript origins:**
     - `http://localhost:3000`
     - `https://YOUR-PROJECT.vercel.app` (add later after deploy)
   - **Authorized redirect URIs:**
     - `https://YOUR-PROJECT.supabase.co/auth/v1/callback`
       (replace `YOUR-PROJECT` with your Supabase project ref — find it in Supabase Settings → API)
5. Click **Create** → copy the **Client ID** + **Client Secret**

#### 3b. Connect to Supabase

1. In Supabase → **Authentication** → **Providers** → find **Google**
2. Toggle **Enable Sign in with Google** on
3. Paste:
   - **Client ID** (from Google)
   - **Client Secret** (from Google)
4. Click **Save**

### Step 4: Get Supabase API Keys (1 min)

1. In Supabase → **Settings** → **API**
2. Copy these 2 values:
   - **Project URL** (e.g. `https://abcdefg.supabase.co`)
   - **anon / public key** (under "Project API keys")

### Step 5: Configure Your App (2 min)

1. Open `.env.local` in your project root
2. Add at the bottom:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...your_anon_key...
   ```
3. Restart dev server: `Ctrl+C` then `npm run dev`

### Step 6: Test Locally (2 min)

1. Open http://localhost:3000 → should redirect to `/login`
2. Click **Continue with Google** → sign in with your Google account
3. After login, you'll be redirected to `/pending` (awaiting approval)
4. **You are the admin** — promote yourself:

   In Supabase → **Table Editor** → **profiles** table → find your row →
   - Change `status` to **`approved`**
   - Change `role` to **`admin`**
   - Save

   OR run in SQL Editor:
   ```sql
   update public.profiles
   set role = 'admin', status = 'approved'
   where email = 'YOUR_GOOGLE_EMAIL@gmail.com';
   ```

5. Refresh browser → should redirect to `/dashboard` ✅
6. You can now access `/admin` page to approve other users

### Step 7: Deploy to Vercel (10 min)

#### 7a. Push to GitHub

1. Create new private repo on [github.com](https://github.com) → name: `alpha-dashboard`
2. In project folder, open PowerShell:
   ```bash
   git init
   git add .
   git commit -m "Initial Alpha Dashboard with cloud setup"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/alpha-dashboard.git
   git push -u origin main
   ```

#### 7b. Deploy via Vercel

1. Go to [vercel.com](https://vercel.com) → sign in with GitHub
2. Click **Add New** → **Project** → import your `alpha-dashboard` repo
3. Framework Preset: **Next.js** (auto-detected)
4. **Environment Variables** → add 2:
   - `NEXT_PUBLIC_SUPABASE_URL` = (your Supabase URL)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (your anon key)
   - (optional) `NEXT_PUBLIC_FINNHUB_API_KEY`, `NEXT_PUBLIC_ANTHROPIC_API_KEY`
5. Click **Deploy** → wait ~2 min

#### 7c. Update Google OAuth with production URL

1. After Vercel deploy → copy your Vercel URL (e.g. `alpha-dashboard.vercel.app`)
2. Back in Google Cloud Console → Credentials → your OAuth client
3. Add to **Authorized JavaScript origins:**
   - `https://alpha-dashboard.vercel.app`
4. Add to **Authorized redirect URIs** (already added in Step 3, verify it's there)
5. Save

#### 7d. Update Supabase Site URL

1. Supabase → **Authentication** → **URL Configuration**
2. **Site URL:** `https://alpha-dashboard.vercel.app`
3. **Redirect URLs:** add `https://alpha-dashboard.vercel.app/**`
4. Save

### Step 8: Test Production (5 min)

1. Open `https://alpha-dashboard.vercel.app` in incognito
2. Should redirect to `/login`
3. Sign in with Google → land on `/pending`
4. Login as admin in another browser → go to `/admin` → approve the new user
5. New user refreshes → redirected to `/dashboard` ✅

---

## 👥 How Approval Works (For Friends/Family)

### When a new friend wants to join:

1. **Friend visits** `https://alpha-dashboard.vercel.app`
2. **Clicks "Continue with Google"** → signs in
3. **Sees "Awaiting Approval"** page (auto-refreshes every 10s)
4. **Their account** appears in your `/admin` page with status `pending`
5. **You click "Approve"** → friend's screen auto-redirects to dashboard ✅

### Admin controls (you):
- **Approve** — give access
- **Deny** — block them (data still in DB, you can re-approve later)
- **Make Admin** — promote to admin (can also approve users)
- **Demote** — remove admin from a user

---

## 🔒 Security Features Built-In

✅ **Row Level Security** — each user can only see their own positions/watchlist/data
✅ **JWT tokens** — Supabase handles secure sessions
✅ **OAuth only** — no password storage on your end
✅ **Admin approval** — strangers can't access even if they sign up
✅ **Per-user data isolation** — friend A's portfolio invisible to friend B
✅ **Private GitHub repo** — code not public
✅ **Env vars on Vercel** — API keys not in code

---

## 💰 Cost Breakdown (Free Tier Limits)

| Service | Free Tier | What it covers |
|---------|----------|----------------|
| **Supabase** | 500MB DB, 2GB egress, 50K MAU | ~50 active users easily |
| **Vercel** | 100GB bandwidth/mo, unlimited deploys | More than enough |
| **Google OAuth** | Unlimited | Always free |

If you exceed free tier (unlikely for 5-20 users):
- Supabase Pro: $25/month (8GB DB, 250GB egress)
- Vercel Pro: $20/month (1TB bandwidth)

---

## 🚧 Troubleshooting

### ⚠ "Supabase env vars missing"
- Check `.env.local` has the 2 vars
- Restart dev server after adding

### ⚠ Login button does nothing
- Check browser console for errors
- Verify Google OAuth credentials saved in Supabase

### ⚠ "Invalid redirect URL" after Google login
- Make sure redirect URI in Google Console exactly matches Supabase's callback:
  `https://YOUR-PROJECT.supabase.co/auth/v1/callback`

### ⚠ Approved but still stuck on /pending
- Hard refresh (Ctrl+Shift+R)
- Or click "Check now" button on the pending page

### ⚠ Can't access /admin
- Verify your `role` is set to `admin` in Supabase profiles table
- Logout and login again to refresh session

---

## 📊 What's NOT Migrated Yet (Future Work)

The current code still uses localStorage for portfolio data. To complete migration:

- [ ] Replace `localStorage.getItem("alpha_positions")` → Supabase `positions` table
- [ ] Replace `localStorage.setItem("alpha_positions", ...)` → Supabase upsert
- [ ] Same for: `alpha_watchlist`, `alpha_settings`, `alpha_alerts`, `alpha_trades`
- [ ] Sync between cloud and localStorage cache for offline support
- [ ] One-time migration: import existing localStorage data → Supabase on first login

This is **Phase 3** of the cloud migration — separate task. The current setup gets you auth + permission + deployment.

For now: each user has their own localStorage in their browser (per device). To share/sync data across devices, complete Phase 3.

---

## ✅ Setup Complete — Your URLs

After setup:
- **Production:** `https://YOUR-PROJECT.vercel.app`
- **Admin panel:** `https://YOUR-PROJECT.vercel.app/admin`
- **Supabase dashboard:** `https://supabase.com/dashboard/project/YOUR-PROJECT`
- **Vercel dashboard:** `https://vercel.com/YOUR-USERNAME/alpha-dashboard`

Share the production URL with friends — they sign in, you approve, done! 🎉
