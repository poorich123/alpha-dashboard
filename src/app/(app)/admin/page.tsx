"use client"

import { useEffect, useState, useCallback } from "react"
import { Check, X, Shield, RefreshCw, User as UserIcon } from "lucide-react"
import { getSupabaseBrowser } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import toast from "react-hot-toast"
import type { Profile } from "@/lib/supabase/types"
import { formatDistanceToNow } from "date-fns"

export default function AdminPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = getSupabaseBrowser()
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false })
      if (error) throw error
      setProfiles(data || [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function updateStatus(id: string, status: "approved" | "denied" | "pending") {
    try {
      const supabase = getSupabaseBrowser()
      const { error } = await supabase
        .from("profiles")
        .update({
          status,
          approved_at: status === "approved" ? new Date().toISOString() : null,
        })
        .eq("id", id)
      if (error) throw error
      toast.success(`User ${status}`)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed")
    }
  }

  async function toggleRole(id: string, currentRole: string) {
    const newRole = currentRole === "admin" ? "user" : "admin"
    try {
      const supabase = getSupabaseBrowser()
      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole })
        .eq("id", id)
      if (error) throw error
      toast.success(`Role updated to ${newRole}`)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed")
    }
  }

  const pending  = profiles.filter(p => p.status === "pending")
  const approved = profiles.filter(p => p.status === "approved")
  const denied   = profiles.filter(p => p.status === "denied")

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-cyan-400" />
            Admin · User Approval
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {pending.length} pending · {approved.length} approved · {denied.length} denied
          </p>
        </div>
        <Button onClick={load} disabled={loading} variant="outline" size="sm" className="border-[#1F3566] text-gray-300">
          <RefreshCw className={cn("w-3.5 h-3.5 mr-1", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {pending.length > 0 && (
        <Section title="⏳ Pending Approval" color="yellow">
          {pending.map(p => (
            <ProfileRow key={p.id} profile={p}
              onApprove={() => updateStatus(p.id, "approved")}
              onDeny={() => updateStatus(p.id, "denied")}
              onToggleRole={() => toggleRole(p.id, p.role)}
            />
          ))}
        </Section>
      )}

      {approved.length > 0 && (
        <Section title="✅ Approved Users" color="emerald">
          {approved.map(p => (
            <ProfileRow key={p.id} profile={p}
              onDeny={() => updateStatus(p.id, "denied")}
              onToggleRole={() => toggleRole(p.id, p.role)}
            />
          ))}
        </Section>
      )}

      {denied.length > 0 && (
        <Section title="❌ Denied" color="red">
          {denied.map(p => (
            <ProfileRow key={p.id} profile={p}
              onApprove={() => updateStatus(p.id, "approved")}
            />
          ))}
        </Section>
      )}

      {profiles.length === 0 && !loading && (
        <div className="text-center py-16 text-gray-500">
          <UserIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No users yet</p>
        </div>
      )}
    </div>
  )
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  const borderColor = color === "yellow" ? "border-yellow-500/30" : color === "emerald" ? "border-emerald-500/30" : "border-red-500/30"
  return (
    <div className={cn("bg-[#0C1628] border rounded-2xl p-4 mb-4", borderColor)}>
      <div className="text-sm font-semibold text-white mb-3">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

interface RowProps {
  profile: Profile
  onApprove?: () => void
  onDeny?: () => void
  onToggleRole?: () => void
}

function ProfileRow({ profile, onApprove, onDeny, onToggleRole }: RowProps) {
  return (
    <div className="flex items-center gap-3 bg-[#070B18]/60 border border-[#1A2E52] rounded-lg p-3">
      {profile.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.avatar_url} alt="" className="w-9 h-9 rounded-full" />
      ) : (
        <div className="w-9 h-9 rounded-full bg-[#1A2E52] flex items-center justify-center text-xs text-cyan-400 font-bold">
          {profile.email[0]?.toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white truncate">{profile.full_name || profile.email}</span>
          {profile.role === "admin" && (
            <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-500/30 font-bold">ADMIN</span>
          )}
        </div>
        <div className="text-xs text-gray-500 truncate">{profile.email}</div>
        <div className="text-[10px] text-gray-600">
          Signed up {formatDistanceToNow(new Date(profile.created_at), { addSuffix: true })}
        </div>
      </div>
      <div className="flex gap-1">
        {onApprove && (
          <Button onClick={onApprove} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs">
            <Check className="w-3 h-3 mr-1" /> Approve
          </Button>
        )}
        {onDeny && (
          <Button onClick={onDeny} size="sm" variant="outline" className="border-red-500/40 text-red-400 hover:bg-red-500/10 h-7 text-xs">
            <X className="w-3 h-3 mr-1" /> Deny
          </Button>
        )}
        {onToggleRole && (
          <Button onClick={onToggleRole} size="sm" variant="ghost" className="text-cyan-400 h-7 text-xs">
            <Shield className="w-3 h-3 mr-1" /> {profile.role === "admin" ? "Demote" : "Make Admin"}
          </Button>
        )}
      </div>
    </div>
  )
}
