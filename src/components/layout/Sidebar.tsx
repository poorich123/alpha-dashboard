"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import {
  LayoutDashboard,
  Briefcase,
  LineChart,
  Star,
  Newspaper,
  Eye,
  Target,
  Bot,
  BarChart3,
  Settings,
  TrendingUp,
  Bell,
  ScanLine,
  Globe,
  Shield,
  LogOut,
  Sparkles,
  Activity,
  BookOpen,
} from "lucide-react"
import { getSupabaseBrowser, hasSupabaseConfigured } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { usePortfolioStore } from "@/store/portfolioStore"
import { useAlertStore } from "@/store/alertStore"
import { getRoundIcon, PAGE_CHARACTERS } from "@/components/hsr/characters"

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/market", icon: Sparkles, label: "Market", highlight: true },
  { href: "/analyzer", icon: ScanLine, label: "Analyzer", highlight: true },
  { href: "/macro", icon: Globe, label: "Macro Risk", highlight: true },
  { href: "/smartmoney", icon: Activity, label: "Smart Money", highlight: true },
  { href: "/portfolio", icon: Briefcase, label: "Portfolio" },
  { href: "/journal", icon: BookOpen, label: "Journal" },
  { href: "/charts", icon: LineChart, label: "Charts" },
  { href: "/rating", icon: Star, label: "Rating" },
  { href: "/news", icon: Newspaper, label: "News & Events" },
  { href: "/watchlist", icon: Eye, label: "Watchlist" },
  { href: "/strategy", icon: Target, label: "Strategy" },
  { href: "/advisor", icon: Bot, label: "AI Advisor" },
  { href: "/analytics", icon: BarChart3, label: "Analytics" },
  { href: "/settings", icon: Settings, label: "Settings" },
]

// Which character icon to show based on current page
function getPageCharacter(pathname: string) {
  if (pathname.includes("/analyzer"))  return PAGE_CHARACTERS.analyzer
  if (pathname.includes("/macro"))     return PAGE_CHARACTERS.analytics  // Black Swan
  if (pathname.includes("/news"))      return PAGE_CHARACTERS.news
  if (pathname.includes("/advisor"))   return PAGE_CHARACTERS.advisor
  if (pathname.includes("/strategy"))  return PAGE_CHARACTERS.strategy
  if (pathname.includes("/analytics")) return PAGE_CHARACTERS.analytics
  if (pathname.includes("/watchlist")) return PAGE_CHARACTERS.watchlist
  if (pathname.includes("/portfolio")) return PAGE_CHARACTERS.portfolio
  return PAGE_CHARACTERS.dashboard
}

export function Sidebar() {
  const pathname = usePathname()
  const { settings, isDemoMode } = usePortfolioStore()
  const { unreadCount, setPanelOpen, alerts, isMonitoring } = useAlertStore()
  const criticalCount = alerts.filter(a => !a.read && a.impact === "CRITICAL").length
  const pageChar = getPageCharacter(pathname)
  const [isAdmin, setIsAdmin] = useState(false)
  const [userEmail, setUserEmail] = useState<string>("")

  // Check if current user is admin (only when Supabase configured)
  useEffect(() => {
    if (!hasSupabaseConfigured()) return
    const supabase = getSupabaseBrowser()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setUserEmail(user.email || "")
      const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single()
      setIsAdmin(data?.role === "admin")
    })
  }, [])

  async function logout() {
    if (!hasSupabaseConfigured()) return
    const supabase = getSupabaseBrowser()
    await supabase.auth.signOut()
    window.location.href = "/login"
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-[#0C1628] border-r border-[#1A2E52] flex flex-col z-40 hidden lg:flex">
      {/* Logo */}
      <div className="p-4 border-b border-[#1A2E52]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#00C2D4] flex items-center justify-center hsr-glow">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-sm text-white">Alpha Dashboard</div>
            <div className="text-xs text-gray-500 truncate max-w-[110px]">
              {settings.portfolioName}
            </div>
          </div>
        </div>
        {isDemoMode && (
          <div className="mt-2 text-xs bg-yellow-500/20 text-yellow-400 rounded px-2 py-0.5 text-center">
            DEMO MODE
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 overflow-y-auto">
        {navItems.map(({ href, icon: Icon, label, highlight }) => {
          const active = pathname === href || pathname.startsWith(href + "/")
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg mb-0.5 text-sm transition-all",
                active
                  ? "bg-[#00C2D4]/20 text-[#00D8EE] font-medium"
                  : highlight
                  ? "text-cyan-300 hover:bg-[#00C2D4]/10 hover:text-white border border-[#00C2D4]/20"
                  : "text-gray-400 hover:bg-[#1A2E52] hover:text-white"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{label}</span>
              {highlight && !active && (
                <span className="ml-auto text-[9px] bg-[#00C2D4]/20 text-[#00D8EE] px-1.5 py-0.5 rounded-full font-bold">NEW</span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Alert Bell */}
      <div className="px-3 pb-2">
        <button
          onClick={() => setPanelOpen(true)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all",
            criticalCount > 0
              ? "text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 critical-pulse"
              : unreadCount > 0
              ? "text-[#00D8EE] bg-[#00C2D4]/10 hover:bg-[#00C2D4]/20 border border-[#00C2D4]/20"
              : "text-gray-400 hover:bg-[#1A2E52] hover:text-white"
          )}
        >
          <div className="relative flex-shrink-0">
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className={cn(
                "absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] rounded-full text-[9px] font-bold flex items-center justify-center px-0.5",
                criticalCount > 0 ? "bg-red-500 text-white" : "bg-[#00C2D4] text-[#070B18]"
              )}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </div>
          <span>Alerts</span>
          {unreadCount > 0 && (
            <span className={cn(
              "ml-auto text-xs px-1.5 py-0.5 rounded-full",
              criticalCount > 0 ? "bg-red-500/20 text-red-300" : "bg-[#00C2D4]/20 text-[#00D8EE]"
            )}>
              {unreadCount} new
            </span>
          )}
        </button>
      </div>

      {/* Admin link (only for admins) */}
      {isAdmin && (
        <div className="px-3 pb-1">
          <Link
            href="/admin"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all",
              pathname.startsWith("/admin")
                ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-medium"
                : "text-gray-400 hover:bg-[#1A2E52] hover:text-white"
            )}
          >
            <Shield className="w-4 h-4 flex-shrink-0" />
            <span>Admin</span>
            <span className="ml-auto text-[9px] bg-cyan-500/20 text-cyan-300 px-1.5 rounded-full font-bold">PRIV</span>
          </Link>
        </div>
      )}

      {/* Logout button (only when Supabase configured) */}
      {userEmail && (
        <div className="px-3 pb-1">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-red-500/10 hover:text-red-400 transition-all"
            title={`Sign out (${userEmail})`}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span>Sign out</span>
          </button>
        </div>
      )}

      {/* HSR Character Footer */}
      <div className="p-3 border-t border-[#1A2E52]">
        {/* Character strip */}
        <div
          className="flex items-center gap-2 p-2 rounded-lg mb-2 border transition-colors"
          style={{
            borderColor: pageChar.color + "33",
            background: `linear-gradient(to right, ${pageChar.glowColor.replace("0.4","0.07")}, transparent)`
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getRoundIcon(pageChar.id)}
            alt={pageChar.name}
            className="w-7 h-7 rounded-full border flex-shrink-0"
            style={{ borderColor: pageChar.color + "66" }}
          />
          <div className="min-w-0">
            <div className="text-xs font-semibold truncate" style={{ color: pageChar.color }}>
              {pageChar.name}
            </div>
            <div className="text-[9px] text-gray-600 truncate">{pageChar.role}</div>
          </div>
          {isMonitoring && (
            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" title="Monitoring active" />
          )}
        </div>

        <div className="text-[10px] text-gray-700 text-center">
          {settings.ownerName} • Alpha v1.0
        </div>
      </div>
    </aside>
  )
}

export function MobileNav() {
  const pathname = usePathname()
  const mainItems = navItems.slice(0, 5)

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#0C1628] border-t border-[#1A2E52] flex lg:hidden z-40">
      {mainItems.map(({ href, icon: Icon, label }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex-1 flex flex-col items-center py-2 text-xs transition-colors",
              active ? "text-[#00D8EE]" : "text-gray-500"
            )}
          >
            <Icon className="w-5 h-5 mb-0.5" />
            <span className="truncate">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
