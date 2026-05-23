"use client"

import { useEffect, useState } from "react"
import { Clock, LogOut, RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"
import { getSupabaseBrowser } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { getDrawCard, getRoundIcon } from "@/components/hsr/characters"

export default function PendingPage() {
  const router = useRouter()
  const [email, setEmail] = useState<string>("")
  const [status, setStatus] = useState<string>("pending")
  const [checking, setChecking] = useState(false)

  async function checkStatus() {
    setChecking(true)
    try {
      const supabase = getSupabaseBrowser()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace("/login")
        return
      }
      setEmail(user.email || "")
      const { data: profile } = await supabase
        .from("profiles")
        .select("status")
        .eq("id", user.id)
        .single()
      if (profile?.status === "approved") {
        router.replace("/dashboard")
        return
      }
      if (profile?.status === "denied") {
        setStatus("denied")
        return
      }
      setStatus("pending")
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    checkStatus()
    // Poll every 10s in case admin just approved
    const interval = setInterval(checkStatus, 10_000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function logout() {
    const supabase = getSupabaseBrowser()
    await supabase.auth.signOut()
    router.replace("/login")
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#070B18]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={getDrawCard(1303)}
        alt=""
        className="fixed left-0 top-0 h-full opacity-20 pointer-events-none"
        style={{ width: "auto", maskImage: "linear-gradient(to right, black 0%, transparent 70%)" }}
      />

      <div className="relative w-full max-w-md text-center">
        <div className="w-20 h-20 rounded-full bg-yellow-500/20 border-2 border-yellow-500/40 flex items-center justify-center mx-auto mb-4">
          <Clock className="w-10 h-10 text-yellow-400" />
        </div>

        {status === "pending" ? (
          <>
            <h1 className="text-2xl font-bold text-white mb-2">Awaiting Approval</h1>
            <p className="text-gray-400 mb-1">Hi <span className="text-cyan-400">{email}</span></p>
            <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
              Your account is pending admin approval. You&apos;ll be redirected automatically once approved.
            </p>
            <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-4 mb-6 text-left">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Next Steps</div>
              <ul className="space-y-1.5 text-xs text-gray-400">
                <li>✓ Account created</li>
                <li>⏳ Waiting for admin to approve</li>
                <li className="text-gray-600">○ Access granted (auto-redirect)</li>
              </ul>
            </div>
            <div className="flex gap-2 justify-center">
              <Button
                onClick={checkStatus}
                disabled={checking}
                variant="outline"
                size="sm"
                className="border-[#1F3566] text-gray-300"
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${checking ? "animate-spin" : ""}`} />
                Check now
              </Button>
              <Button onClick={logout} variant="ghost" size="sm" className="text-gray-500">
                <LogOut className="w-3 h-3 mr-1" />
                Sign out
              </Button>
            </div>
            <p className="text-[10px] text-gray-600 mt-4">Auto-checking every 10 seconds</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-red-400 mb-2">Access Denied</h1>
            <p className="text-gray-400 mb-6">
              Your access request has been denied. Contact the admin if you believe this is an error.
            </p>
            <Button onClick={logout} variant="outline" className="border-[#1F3566] text-gray-300">
              <LogOut className="w-3 h-3 mr-1" />
              Sign out
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
