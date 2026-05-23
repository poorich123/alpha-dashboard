"use client"

import { useState } from "react"
import { TrendingUp, Loader2, AlertCircle } from "lucide-react"
import { getSupabaseBrowser, hasSupabaseConfigured } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { getDrawCard } from "@/components/hsr/characters"

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const configured = hasSupabaseConfigured()

  async function loginWithGoogle() {
    if (!configured) {
      setError("Supabase not configured. See supabase/SETUP.md")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const supabase = getSupabaseBrowser()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#070B18]">
      {/* HSR Acheron background */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={getDrawCard(1308)}
        alt=""
        className="fixed right-0 top-0 h-full opacity-30 pointer-events-none"
        style={{ width: "auto", maskImage: "linear-gradient(to left, black 0%, transparent 70%)" }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#070B18] via-[#070B18]/80 to-transparent pointer-events-none" />

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[#00C2D4] flex items-center justify-center mx-auto mb-4 hsr-glow">
            <TrendingUp className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Alpha Dashboard</h1>
          <p className="text-gray-400 text-sm">Your personal hedge fund management system</p>
        </div>

        <div className="bg-[#0C1628]/80 backdrop-blur-md border border-[#1A2E52] rounded-2xl p-6 hsr-card">
          <h2 className="text-xl font-semibold text-white mb-1">Sign In</h2>
          <p className="text-xs text-gray-500 mb-6">Access requires admin approval after first sign-in</p>

          <Button
            onClick={loginWithGoogle}
            disabled={loading}
            className="w-full bg-white text-gray-900 hover:bg-gray-100 font-medium h-11 flex items-center gap-2 justify-center"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z" fill="#4285F4"/>
                <path d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2c-.71.48-1.62.78-2.7.78-2.08 0-3.84-1.4-4.48-3.3H1.83v2.07A8 8 0 0 0 8.98 17z" fill="#34A853"/>
                <path d="M4.5 10.54a4.77 4.77 0 0 1-.25-1.54c0-.55.1-1.07.25-1.54V5.39H1.83a8 8 0 0 0 0 7.22l2.67-2.07z" fill="#FBBC05"/>
                <path d="M8.98 3.95c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.46c.64-1.9 2.4-3.5 4.48-3.5z" fill="#EA4335"/>
              </svg>
            )}
            Continue with Google
          </Button>

          {error && (
            <div className="mt-4 flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}

          {!configured && (
            <div className="mt-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-xs text-yellow-300">
              ⚠ Supabase not configured. See <code className="bg-black/40 px-1 rounded">supabase/SETUP.md</code> for setup instructions.
            </div>
          )}

          <p className="text-[10px] text-gray-600 mt-6 text-center">
            By signing in you agree to allow admin-approved access only.<br />
            Your data is private and isolated per account.
          </p>
        </div>
      </div>
    </div>
  )
}
