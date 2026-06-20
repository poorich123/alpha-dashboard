"use client"

import { useState, useEffect, useCallback } from "react"
import { RefreshCw, AlertTriangle, Zap, ShieldAlert, Compass, TrendingUp, TrendingDown } from "lucide-react"
import { detectMacroRisks, detectDalioRegime, type MacroSnapshot, type RiskFactor, type DalioRegime } from "@/lib/macroRisk"
import { detectSupplyChainHealth, type SupplyChainSnapshot } from "@/lib/supplyChain"
import { SupplyChainCard } from "@/components/macro/SupplyChainCard"
import { HSRHeroBanner } from "@/components/hsr/HSRHeroBanner"
import { PAGE_CHARACTERS } from "@/components/hsr/characters"
import { InlineSpinner } from "@/components/ui/LoadingSpinner"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"

function levelColors(level: string) {
  if (level === "EXTREME") return { text: "text-red-300",    border: "border-red-500/50",    bg: "bg-red-500/15",    dot: "bg-red-500 critical-pulse" }
  if (level === "HIGH")    return { text: "text-orange-400", border: "border-orange-500/40", bg: "bg-orange-500/10", dot: "bg-orange-500" }
  if (level === "MEDIUM")  return { text: "text-yellow-400", border: "border-yellow-500/40", bg: "bg-yellow-500/10", dot: "bg-yellow-500" }
  return                       { text: "text-emerald-400", border: "border-emerald-500/30", bg: "bg-emerald-500/5",  dot: "bg-emerald-500" }
}

function toneColor(tone: string) {
  if (tone === "good") return "text-emerald-400"
  if (tone === "warn") return "text-yellow-400"
  if (tone === "bad")  return "text-red-400"
  return "text-gray-300"
}

function FactorCard({ factor }: { factor: RiskFactor }) {
  const c = levelColors(factor.level)
  return (
    <div className={cn("rounded-2xl border p-4 hsr-card transition-colors", c.border, c.bg)}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl leading-none">{factor.emoji}</span>
          <div>
            <div className="text-sm font-bold text-white">{factor.label}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={cn("w-1.5 h-1.5 rounded-full", c.dot)} />
              <span className={cn("text-[10px] font-bold uppercase tracking-wider", c.text)}>
                {factor.level}
              </span>
              <span className="text-[10px] text-gray-500">· score {factor.score}/10</span>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-1.5 mb-3 text-xs">
        {factor.metrics.map((m, i) => (
          <div key={i} className="flex items-center justify-between bg-[#070B18]/50 rounded px-2 py-1 border border-[#1A2E52]/40">
            <span className="text-gray-500">{m.label}</span>
            <span className={cn("font-mono font-semibold", toneColor(m.tone))}>{m.value}</span>
          </div>
        ))}
      </div>

      {/* Signal */}
      <div className="mb-2">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Signal</div>
        <p className={cn("text-xs leading-relaxed", c.text)}>{factor.signal}</p>
      </div>

      {/* What to do */}
      <div className="bg-[#070B18]/60 border border-[#1A2E52]/60 rounded-lg p-2">
        <div className="flex items-start gap-1.5">
          <Zap className="w-3 h-3 text-cyan-400 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-[10px] text-cyan-500 uppercase tracking-wider mb-0.5">What to do</div>
            <p className="text-xs text-gray-300 leading-relaxed">{factor.whatToDo}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function RegimeCard({ regime }: { regime: DalioRegime }) {
  if (!regime.available) {
    return (
      <div className="rounded-2xl border border-[#1A2E52] bg-[#0C1628] p-4 mb-4 text-sm text-gray-500">
        Dalio Regime: ข้อมูลตลาดไม่พอประเมิน (ลอง Refresh)
      </div>
    )
  }

  // 2×2 quadrant: x = Inflation (left Falling, right Rising), y = Growth (top Rising, bottom Falling)
  const cells: { key: DalioRegime["regimeKey"]; title: string; sub: string }[] = [
    { key: "goldilocks",  title: "🌤️ Goldilocks",  sub: "Growth↑ Infl↓" },
    { key: "reflation",   title: "🔥 Reflation",   sub: "Growth↑ Infl↑" },
    { key: "deflation",   title: "❄️ Deflation",   sub: "Growth↓ Infl↓" },
    { key: "stagflation", title: "🥵 Stagflation", sub: "Growth↓ Infl↑" },
  ]

  return (
    <div className="rounded-2xl border border-[#1A2E52] bg-[#0C1628] p-4 mb-4 hsr-card">
      <div className="flex items-center gap-2 mb-3">
        <Compass className="w-4 h-4 text-violet-400" />
        <div>
          <div className="text-sm font-bold text-white">Dalio Regime Detector</div>
          <div className="text-[10px] text-gray-500">
            กรอบ Growth × Inflation ของ Ray Dalio — อนุมานจาก market proxies (copper/gold · SPY · credit · yields · oil)
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        {/* Quadrant */}
        <div>
          <div className="grid grid-cols-2 gap-1.5">
            {cells.map(c => {
              const active = c.key === regime.regimeKey
              return (
                <div key={c.key} className={cn(
                  "rounded-lg border p-2.5 text-center transition-colors",
                  active ? "border-violet-500/60 bg-violet-500/15" : "border-[#1A2E52] bg-[#070B18] opacity-50",
                )}>
                  <div className={cn("text-xs font-bold", active ? "text-white" : "text-gray-500")}>{c.title}</div>
                  <div className="text-[9px] text-gray-500 mt-0.5">{c.sub}</div>
                  {active && <div className="text-[8px] text-violet-300 mt-1 font-bold uppercase tracking-wider">● ตอนนี้</div>}
                </div>
              )
            })}
          </div>
          {/* Axis direction bars */}
          <div className="mt-3 space-y-2">
            <AxisBar label="Growth" dir={regime.growthDir} score={regime.growthScore} />
            <AxisBar label="Inflation" dir={regime.inflationDir} score={regime.inflationScore} />
          </div>
        </div>

        {/* Current regime detail */}
        <div>
          <div className={cn("text-lg font-bold", regime.color)}>{regime.emoji} {regime.regimeLabel}</div>
          <p className="text-xs text-gray-400 mt-1 mb-3 leading-relaxed">{regime.description}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
            <div className="bg-[#070B18] border border-emerald-500/20 rounded-lg p-2.5">
              <div className="text-[10px] text-emerald-400 uppercase tracking-wider mb-1">✓ น่าจะได้เปรียบ</div>
              <div className="flex flex-wrap gap-1">
                {regime.favored.map((a, i) => (
                  <span key={i} className="text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded px-1.5 py-0.5">{a}</span>
                ))}
              </div>
            </div>
            <div className="bg-[#070B18] border border-red-500/20 rounded-lg p-2.5">
              <div className="text-[10px] text-red-400 uppercase tracking-wider mb-1">✗ ควรเลี่ยง</div>
              <div className="flex flex-wrap gap-1">
                {regime.avoid.map((a, i) => (
                  <span key={i} className="text-[10px] bg-red-500/10 text-red-300 border border-red-500/20 rounded px-1.5 py-0.5">{a}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Indicator votes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <IndicatorList title="Growth signals" items={regime.growthIndicators} />
            <IndicatorList title="Inflation signals" items={regime.inflationIndicators} />
          </div>
        </div>
      </div>
    </div>
  )
}

function AxisBar({ label, dir, score }: { label: string; dir: "Rising" | "Falling"; score: number }) {
  const rising = dir === "Rising"
  const mag = Math.abs(score)
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] mb-0.5">
        <span className="text-gray-400">{label}</span>
        <span className={cn("font-bold flex items-center gap-0.5", rising ? "text-emerald-400" : "text-red-400")}>
          {rising ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {dir} ({mag}% conviction)
        </span>
      </div>
      <div className="h-1.5 bg-[#1A2E52] rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", rising ? "bg-emerald-500" : "bg-red-500")} style={{ width: `${mag}%` }} />
      </div>
    </div>
  )
}

function IndicatorList({ title, items }: { title: string; items: DalioRegime["growthIndicators"] }) {
  return (
    <div className="bg-[#070B18] border border-[#1A2E52]/60 rounded-lg p-2">
      <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">{title}</div>
      <div className="space-y-0.5">
        {items.map((it, i) => (
          <div key={i} className="flex items-center justify-between text-[10px]">
            <span className="text-gray-500 truncate mr-1">{it.label}</span>
            <span className={cn("font-mono flex items-center gap-0.5 flex-shrink-0", it.vote === "up" ? "text-emerald-400" : "text-red-400")}>
              {it.value} {it.vote === "up" ? "↑" : "↓"}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function MacroPage() {
  const [snapshot, setSnapshot] = useState<MacroSnapshot | null>(null)
  const [regime, setRegime] = useState<DalioRegime | null>(null)
  const [supplyChain, setSupplyChain] = useState<SupplyChainSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const character = PAGE_CHARACTERS.analytics  // Black Swan

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [data, reg, sc] = await Promise.all([detectMacroRisks(), detectDalioRegime(), detectSupplyChainHealth()])
      setSnapshot(data)
      setRegime(reg)
      setSupplyChain(sc)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 5 * 60 * 1000) // 5 min
    return () => clearInterval(interval)
  }, [refresh])

  const overall = snapshot ? levelColors(snapshot.overallRisk) : levelColors("LOW")

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      {/* HSR Banner — Black Swan */}
      <HSRHeroBanner character={character} title="Macro Risk Monitor" height="h-44">
        <div className="text-[10px] tracking-[0.2em] uppercase font-semibold mb-1" style={{ color: character.color }}>
          Macro Risk · Whale-Style Monitoring
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">Macro Risk Monitor</h1>
        <div className="text-xs text-gray-400 mb-3">
          Oil · Gold · Yields · DXY · BTC · Bond Vol · Yield Curve · ทุกตัวที่นักลงทุนใหญ่ติดตามแบบ real-time
        </div>

        {snapshot && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("text-xs font-bold px-2.5 py-1 rounded-full border", overall.bg, overall.border, overall.text)}>
              {snapshot.overallRisk}
            </span>
            <span className="text-xs text-gray-500">Risk Score {snapshot.riskScore}/100</span>
            <button onClick={refresh} disabled={loading} className="text-xs text-cyan-400 hover:text-cyan-200 ml-2 flex items-center gap-1">
              <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
              Refresh
            </button>
          </div>
        )}
      </HSRHeroBanner>

      {/* Top Concern Banner */}
      {snapshot && (
        <div className={cn("rounded-2xl border p-4 mb-4 hsr-card", overall.border, overall.bg)}>
          <div className="flex items-start gap-3">
            <ShieldAlert className={cn("w-6 h-6 flex-shrink-0 mt-0.5", overall.text)} />
            <div className="flex-1">
              <div className={cn("text-xs uppercase tracking-widest font-bold mb-1", overall.text)}>
                Top Concern Right Now
              </div>
              <div className="text-base font-semibold text-white">{snapshot.topConcern}</div>
              <div className="text-[10px] text-gray-600 mt-1">
                Auto-refresh every 5 min · last update {formatDistanceToNow(snapshot.scannedAt, { addSuffix: true })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dalio Regime Detector */}
      {regime && <RegimeCard regime={regime} />}

      {/* Supply-Chain Bellwether → De-risk */}
      <SupplyChainCard snap={supplyChain} />

      {/* Loading skeleton */}
      {loading && !snapshot && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="h-56 bg-[#0C1628] border border-[#1A2E52] rounded-2xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Factor grid */}
      {snapshot && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-4">
          {snapshot.factors.map((f) => (
            <FactorCard key={f.id} factor={f} />
          ))}
        </div>
      )}

      {/* Footer note */}
      <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-4 mt-4 text-xs text-gray-500 leading-relaxed">
        <div className="flex items-center gap-1.5 mb-2 text-gray-400 font-semibold">
          <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
          How this works
        </div>
        <p className="mb-2">
          ทุกตัวเลขเป็น <span className="text-cyan-400">real-time</span> ดึงจาก Yahoo Finance ทุก 5 นาที — ครอบคลุมตัวบ่งชี้ที่ hedge fund + macro trader ใหญ่ ๆ ติดตาม:
        </p>
        <ul className="space-y-1 list-disc list-inside ml-2">
          <li><span className="text-gray-300">🌍 Geopolitical</span> — Gold + Oil + VIX combo signals war/Iran/crisis</li>
          <li><span className="text-gray-300">🛢️ Oil & Energy</span> — WTI/Brent spike = supply shock / OPEC / Middle East</li>
          <li><span className="text-gray-300">🔥 Inflation & Fed</span> — 10Y yield, TIPS expectations</li>
          <li><span className="text-gray-300">📉 Yield Curve</span> — 10Y-5Y spread (inverted = recession signal)</li>
          <li><span className="text-gray-300">💵 Dollar (USD/UUP)</span> — strong $ = risk-off / EM pain</li>
          <li><span className="text-gray-300">📊 Bond Vol (MOVE)</span> — "VIX of bonds" — bank/liquidity stress</li>
          <li><span className="text-gray-300">₿ Crypto</span> — BTC = risk appetite barometer</li>
        </ul>
      </div>
    </div>
  )
}
