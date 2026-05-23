/**
 * OAuth callback handler.
 * Exchanges the code for a session, then redirects based on profile status.
 */
import { NextResponse, type NextRequest } from "next/server"
import { getSupabaseServer } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") || "/dashboard"

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const supabase = await getSupabaseServer()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`)
  }

  // Check approval status
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${origin}/login`)
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .single()

  if (!profile || profile.status === "pending") {
    return NextResponse.redirect(`${origin}/pending`)
  }
  if (profile.status === "denied") {
    return NextResponse.redirect(`${origin}/login?error=access_denied`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
