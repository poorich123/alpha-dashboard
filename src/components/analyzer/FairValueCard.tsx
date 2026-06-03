"use client"

import { Scale, Info, AlertTriangle, Target } from "lucide-react"
import { cn } from "@/lib/utils"
import { InlineSpinner } from "@/components/ui/LoadingSpinner"
import type { FairValueResult, MethodValuation } from "@/lib/fairValue"

interface Props {
  result: FairValueResult | null
  loading: boolean
  error: string | null
}

export function FairValueCard({ result, loading, error }: Props) {
  return (
    <div className="bg-[#0C1628] border border-[#1A2E52] rounded-2xl overflow-hidden hsr-card">
      {/* Header */}
      <div className="bg-[#0A1424] border-b border-[#1A2E52] px-4 py-3 flex items-center gap-2">
        <Scale className="w-4 h-4 text-violet-400" />
        <div>
          <div className="text-sm font-bold text-white">Fair Value · Margin of Safety</div>
          <div className="text-[10px] text-gray-500">
            DCF + Comparable + Asset · ตีมูลค่าที่ควรจะเป็นต่อหุ้น (ไม่ใช่คำแนะนำลงทุน)
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <InlineSpinner className="text-violet-400 w-5 h-5" />
          <span className="ml-2 text-gray-500 text-sm">คำนวณมูลค่าพื้นฐาน…</span>
        </div>
      ) : error ? (
        <div className="px-4 py-6 text-center">
          <div className="text-red-400 text-sm mb-1">⚠️ {error}</div>
          <div className="text-[10px] text-gray-600">ข้อมูลงบการเงินจาก Yahoo อาจไม่พร้อม — ลอง rescan</div>
        </div>
      ) : !result ? (
        <div className="py-10 text-center text-gray-500 text-sm">ไม่มีข้อมูล</div>
      ) : !result.available ? (
        <div className="px-4 py-6 flex items-start gap-2 text-gray-400">
          <Info className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <span className="text-gray-300 font-medium">Valuation N/A</span> ·{" "}
            {result.unavailableReason || "ข้อมูลไม่พอ"}
          </div>
        </div>
      ) : (
        <FairValueBody result={result} />
      )}
    </div>
  )
}

function FairValueBody({ result }: { result: FairValueResult }) {
  const { currentPrice, fairValueBase, fairValueLow, fairValueHigh, marginOfSafety, mosLabel, mosColor } = result

  return (
    <div className="p-4 space-y-4">
      {/* ── Margin of Safety hero ── */}
      <div className={cn(
        "rounded-xl border p-4 flex items-center gap-4 flex-wrap",
        mosLabel === "Deep Value" || mosLabel === "Undervalued" ? "border-emerald-500/40 bg-emerald-500/5" :
        mosLabel === "Fair Value" ? "border-yellow-500/40 bg-yellow-500/5" :
        "border-red-500/40 bg-red-500/5",
      )}>
        <div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">Margin of Safety</div>
          <div className={cn("text-3xl font-bold font-mono", mosColor)}>
            {marginOfSafety != null ? `${marginOfSafety >= 0 ? "+" : ""}${(marginOfSafety * 100).toFixed(1)}%` : "—"}
          </div>
          <div className={cn("text-sm font-semibold", mosColor)}>{mosLabel || "—"}</div>
        </div>
        <div className="flex-1 min-w-[180px]">
          <FairValueBar price={currentPrice} low={fairValueLow} base={fairValueBase} high={fairValueHigh} />
        </div>
      </div>

      {/* ── Price vs fair value summary ── */}
      <div className="grid grid-cols-3 gap-2">
        <StatCell label="ราคาปัจจุบัน" value={fmt(currentPrice)} color="text-white" />
        <StatCell label="Fair Value (กลาง)" value={fmt(fairValueBase)} color="text-violet-300" />
        <StatCell
          label="ช่วงประเมิน"
          value={fairValueLow != null && fairValueHigh != null ? `${fmt(fairValueLow)}–${fmt(fairValueHigh)}` : "—"}
          color="text-gray-300"
          small
        />
      </div>

      {/* ── 3 methods ── */}
      <div>
        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">3 วิธีประเมิน</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {result.methods.map(m => <MethodCard key={m.method} m={m} price={currentPrice} />)}
        </div>
      </div>

      {/* ── Notes ── */}
      {(result.notes.length > 0 || result.analystTarget != null) && (
        <div className="bg-[#070B18] border border-[#1A2E52]/60 rounded-xl p-3 space-y-1">
          {result.analystTarget != null && (
            <div className="flex items-center gap-1.5 text-[11px] text-cyan-300">
              <Target className="w-3 h-3" />
              เป้านักวิเคราะห์เฉลี่ย ${result.analystTarget.toFixed(2)}
            </div>
          )}
          {result.notes.map((n, i) => (
            <div key={i} className="text-[10px] text-gray-500 flex items-start gap-1">
              <span>·</span><span>{n}</span>
            </div>
          ))}
        </div>
      )}

      <div className="text-[10px] text-gray-600 leading-relaxed flex items-start gap-1.5">
        <AlertTriangle className="w-3 h-3 text-gray-600 mt-0.5 flex-shrink-0" />
        <span>
          มูลค่าพื้นฐานอ่อนไหวต่อสมมติฐานมาก (growth / discount rate) — ใช้เป็น <em>กรอบ</em>
          ไม่ใช่ราคาเป้าหมายตายตัว · ข้อมูลงบล่าช้าตามรอบรายงาน
        </span>
      </div>
    </div>
  )
}

// ── Horizontal bar: low–high range with base marker + current price marker ──
function FairValueBar({ price, low, base, high }: {
  price: number | null; low: number | null; base: number | null; high: number | null
}) {
  if (low == null || high == null || base == null) return null
  // Scale spans the fair-value range plus the current price (so price is always visible).
  const lo = Math.min(low, price ?? low) * 0.97
  const hi = Math.max(high, price ?? high) * 1.03
  const span = hi - lo || 1
  const posOf = (v: number) => clamp(((v - lo) / span) * 100, 0, 100)

  const basePos = posOf(base)
  const lowPos = posOf(low)
  const highPos = posOf(high)
  const pricePos = price != null ? posOf(price) : null

  return (
    <div className="pt-4 pb-5 relative">
      {/* track */}
      <div className="h-2 rounded-full bg-[#1A2E52] relative">
        {/* fair value band */}
        <div
          className="absolute h-2 rounded-full bg-violet-500/40"
          style={{ left: `${lowPos}%`, width: `${Math.max(2, highPos - lowPos)}%` }}
        />
        {/* base marker */}
        <div className="absolute -top-0.5 w-1 h-3 bg-violet-300 rounded" style={{ left: `${basePos}%` }} />
        {/* price marker */}
        {pricePos != null && (
          <>
            <div className="absolute -top-1.5 w-0.5 h-5 bg-white" style={{ left: `${pricePos}%` }} />
            <div
              className="absolute -bottom-5 text-[9px] text-white font-mono -translate-x-1/2 whitespace-nowrap"
              style={{ left: `${pricePos}%` }}
            >
              ${price!.toFixed(0)}
            </div>
          </>
        )}
      </div>
      <div
        className="absolute -top-0 text-[9px] text-violet-300 font-mono -translate-x-1/2 whitespace-nowrap"
        style={{ left: `${basePos}%` }}
      >
        FV ${base.toFixed(0)}
      </div>
    </div>
  )
}

function MethodCard({ m, price }: { m: MethodValuation; price: number | null }) {
  const upside = m.valuePerShare != null && price != null && price > 0
    ? (m.valuePerShare - price) / price
    : null
  return (
    <div className={cn(
      "bg-[#070B18] border rounded-xl p-3",
      m.available ? "border-[#1A2E52]/60" : "border-[#1A2E52]/30 opacity-70",
    )}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-[11px] font-semibold text-gray-300">{m.method}</div>
        {m.available
          ? <span className="text-[9px] text-emerald-400">✓</span>
          : <span className="text-[9px] text-gray-600">N/A</span>}
      </div>
      {m.available && m.valuePerShare != null ? (
        <>
          <div className="text-lg font-bold font-mono text-violet-300">${m.valuePerShare.toFixed(2)}</div>
          {upside != null && (
            <div className={cn("text-[10px] font-medium", upside >= 0 ? "text-emerald-400" : "text-red-400")}>
              {upside >= 0 ? "+" : ""}{(upside * 100).toFixed(1)}% vs ราคา
            </div>
          )}
          <ul className="mt-1.5 space-y-0.5">
            {m.assumptions.map((a, i) => (
              <li key={i} className="text-[9px] text-gray-600 leading-snug">· {a}</li>
            ))}
          </ul>
        </>
      ) : (
        <div className="text-[10px] text-gray-600 leading-snug">{m.caveat || "ข้อมูลไม่พอ"}</div>
      )}
    </div>
  )
}

function StatCell({ label, value, color, small }: { label: string; value: string; color: string; small?: boolean }) {
  return (
    <div className="bg-[#070B18] border border-[#1A2E52]/60 rounded-lg p-2.5 text-center">
      <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-0.5">{label}</div>
      <div className={cn("font-bold font-mono", small ? "text-xs" : "text-sm", color)}>{value}</div>
    </div>
  )
}

const fmt = (v: number | null) => v != null ? `$${v.toFixed(2)}` : "—"
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
