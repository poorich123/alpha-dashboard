/**
 * Auth middleware — runs on every request.
 *
 * Behavior:
 *  - Refreshes Supabase session cookies
 *  - Redirects unauthenticated users to /login
 *  - Redirects approved users away from /login
 *  - Redirects pending users to /pending
 *
 * Bypasses (no auth required):
 *  - /login, /pending, /api/*, /_next/*, static files
 *  - Anyone if Supabase isn't configured yet (dev fallback)
 */

import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

const PUBLIC_PATHS = ["/login", "/pending", "/auth/callback", "/onboarding"]
const PUBLIC_PREFIXES = ["/api/", "/_next/", "/static/"]

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.includes(pathname)) return true
  return PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix))
}

export async function middleware(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Supabase not configured yet → allow all (local dev mode)
  if (!url || !key) {
    return NextResponse.next()
  }

  const res = NextResponse.next()

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
      },
    },
  })

  // Refresh session
  const { data: { user } } = await supabase.auth.getUser()

  const pathname = req.nextUrl.pathname

  // Public paths — no auth required
  if (isPublicPath(pathname)) {
    // If already logged in & approved, bounce away from /login
    if (user && pathname === "/login") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("status")
        .eq("id", user.id)
        .single()
      if (profile?.status === "approved") {
        return NextResponse.redirect(new URL("/dashboard", req.url))
      }
      if (profile?.status === "pending") {
        return NextResponse.redirect(new URL("/pending", req.url))
      }
    }
    return res
  }

  // Protected paths — require login
  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  // Check approval status
  const { data: profile } = await supabase
    .from("profiles")
    .select("status, role")
    .eq("id", user.id)
    .single()

  if (!profile) {
    // Profile not yet created (race condition) — wait and let client retry
    return res
  }

  if (profile.status !== "approved") {
    return NextResponse.redirect(new URL("/pending", req.url))
  }

  // Admin-only paths
  if (pathname.startsWith("/admin") && profile.role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", req.url))
  }

  return res
}

export const config = {
  matcher: [
    // Match all paths except static assets
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico)$).*)",
  ],
}
