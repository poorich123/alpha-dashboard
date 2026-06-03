"use client"

import { useState, useEffect, useMemo } from "react"
import { Grid3x3, RefreshCw, AlertTriangle, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { InlineSpinner } from "@/components/ui/LoadingSpinner"
import type { Position } from "@/types"
import {
  fetchAlignedReturns, correlationMatrix, avgBucketCorr, avgOverallCorr, corrColor,
  type AlignedReturns,
} from "@/lib/correlation"

type BucketDim = "sector" | "category"
const MAX_TICKERS = 20

interface CorrComputed {
  ordered: string[]
  mat: number[][]
  buckets: string[]
  bucketColor: Record<string, string>
  bucketStats: { bucket: string; count: number; avg: number }[]
  overall: number
  hotPairs: { a: string; b: string; r: number }[]
}

interface Props {
  positions: Position[]
}

const BUCKET_PALETTE = ["#22d3ee", "#a78bfa", "#f472b6", "#fbbf24", "#34d399", "#60a5fa", "#fb923c", "#f87171", "#a3e635", "#e879f9"]

export function CorrelationMatrix({ positions }: Props) {
  const [dim, setDim] = useState<BucketDim>("sector")
  const [data, setData] = useState<AlignedReturns | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pick up to MAX_TICKERS holdings by market value; keep ticker→position meta.
  const holdings = useMemo(() => {
    const byTicker = new Map<string, Position>()
    for (const p of positions) {
      if (!p.isActive || p.category === "watchlist") continue
      const t = p.ticker.toUpperCase()
      if (!byTicker.has(t)) byTicker.set(t, p)
    }
    return [...byTicker.values()]
      .sort((a, b) => b.shares * b.currentPrice - a.shares * a.currentPrice)
      .slice(0, MAX_TICKERS)
  }, [positions])

  const tickers = useMemo(() => holdings.map(h => h.ticker.toUpperCase()), [holdings])

  const load = async () => {
    if (tickers.length < 2) return
    setLoading(true)
    setError(null)
    try {
      const r = await fetchAlignedReturns(tickers)
      if (Object.keys(r.returns).length < 2) {
        setError("ดึงราคาย้อนหลังได้ไม่พอคำนวณ (ต้องมีอย่างน้อย 2 ตัวที่มีข้อมูลตรงกัน)")
        setData(null)
      } else {
        setData(r)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tickers.join(",")])

  // Bucket assignment + ordering
  const bucketOf = (t: string): string => {
    const p = holdings.find(h => h.ticker.toUpperCase() === t)
    if (!p) return "Other"
    return dim === "sector" ? (p.sector || "Other") : p.category
  }

  const computed = useMemo(() => {
    if (!data || data.tickers.length < 2) return null
    // order surviving tickers grouped by bucket
    const surviving = data.tickers.slice()
    const ordered = surviving.sort((a, b) => {
      const ba = bucketOf(a), bb = bucketOf(b)
      return ba === bb ? a.localeCompare(b) : ba.localeCompare(bb)
    })
    const mat = correlationMatrix(ordered, data.returns)
    const buckets = Array.from(new Set(ordered.map(bucketOf)))
    const bucketColor: Record<string, string> = {}
    buckets.forEach((b, i) => { bucketColor[b] = BUCKET_PALETTE[i % BUCKET_PALETTE.length] })

    const bucketStats = buckets.map(b => {
      const idx = ordered.map((t, i) => ({ t, i })).filter(x => bucketOf(x.t) === b).map(x => x.i)
      return { bucket: b, count: idx.length, avg: avgBucketCorr(idx, mat) }
    })
    const overall = avgOverallCorr(mat)

    // High-correlation pairs (concentration risk)
    const hotPairs: { a: string; b: string; r: number }[] = []
    for (let i = 0; i < ordered.length; i++) {
      for (let j = i + 1; j < ordered.length; j++) {
        if (mat[i][j] >= 0.8) hotPairs.push({ a: ordered[i], b: ordered[j], r: mat[i][j] })
      }
    }
    hotPairs.sort((x, y) => y.r - x.r)

    return { ordered, mat, buckets, bucketColor, bucketStats, overall, hotPairs }
  }, [data, dim]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Grid3x3 className="w-4 h-4 text-cyan-400" />
          <div>
            <div className="text-sm font-bold text-white">Correlation Matrix</div>
            <div className="text-[10px] text-gray-500">
              ความสัมพันธ์ผลตอบแทนรายวัน 6 เดือน · จัดกลุ่มตาม{dim === "sector" ? "เซกเตอร์" : "หมวด"} · แดง = วิ่งไปทางเดียวกัน (เสี่ยงกระจุก)
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex rounded-lg border border-[#1F3566] overflow-hidden">
            {(["sector", "category"] as BucketDim[]).map(d => (
              <button
                key={d}
                onClick={() => setDim(d)}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium transition-colors",
                  dim === d ? "bg-cyan-500/15 text-cyan-300" : "text-gray-400 hover:bg-[#1A2E52]/40",
                )}
              >
                {d === "sector" ? "Sector" : "Category"}
              </button>
            ))}
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="border border-[#1F3566] text-gray-300 rounded-lg h-7 w-7 flex items-center justify-center"
          >
            <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {tickers.length < 2 ? (
        <div className="py-8 text-center text-gray-600 text-sm">ต้องมีอย่างน้อย 2 holdings เพื่อคำนวณ correlation</div>
      ) : loading && !data ? (
        <div className="flex items-center justify-center py-10">
          <InlineSpinner className="text-cyan-400 w-5 h-5" />
          <span className="ml-2 text-gray-500 text-sm">ดึงราคาย้อนหลัง & คำนวณ correlation…</span>
        </div>
      ) : error ? (
        <div className="py-6 text-center text-red-400 text-sm">⚠️ {error}</div>
      ) : !computed ? (
        <div className="py-8 text-center text-gray-600 text-sm">ไม่มีข้อมูล</div>
      ) : (
        <CorrBody computed={computed} bucketOf={bucketOf} days={data?.days ?? 0} />
      )}
    </div>
  )
}

function CorrBody({ computed, bucketOf, days }: {
  computed: CorrComputed
  bucketOf: (t: string) => string
  days: number
}) {
  const { ordered, mat, bucketColor, bucketStats, overall, hotPairs } = computed
  const showNumbers = ordered.length <= 12
  const cell = ordered.length <= 10 ? 30 : ordered.length <= 15 ? 24 : 20

  return (
    <div className="space-y-4">
      {/* Overall diversification readout */}
      <div className={cn(
        "rounded-lg border p-3 flex items-start gap-2",
        overall >= 0.6 ? "border-orange-500/40 bg-orange-500/5" :
        overall >= 0.4 ? "border-yellow-500/40 bg-yellow-500/5" :
        "border-emerald-500/40 bg-emerald-500/5",
      )}>
        <Info className={cn("w-4 h-4 mt-0.5 flex-shrink-0",
          overall >= 0.6 ? "text-orange-400" : overall >= 0.4 ? "text-yellow-400" : "text-emerald-400")} />
        <div className="text-[11px] text-gray-300 leading-relaxed">
          <span className="font-semibold text-white">ค่าเฉลี่ย correlation ทั้งพอร์ต {overall.toFixed(2)}</span>{" "}
          {overall >= 0.6
            ? "— สูง: holdings ส่วนใหญ่วิ่งไปทางเดียวกัน การกระจายความเสี่ยงจริงน้อยกว่าที่เห็น"
            : overall >= 0.4
            ? "— ปานกลาง: มีความสัมพันธ์พอควร ควรดูว่ากระจุกในกลุ่มไหน"
            : "— ต่ำ: พอร์ตกระจายความเสี่ยงได้ดี holdings ไม่ค่อยวิ่งตามกัน"}
          {" "}<span className="text-gray-500">({days} วันทำการ)</span>
        </div>
      </div>

      {/* Heatmap */}
      <div className="overflow-x-auto">
        <table className="border-separate" style={{ borderSpacing: 0 }}>
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-[#0C1628]" style={{ width: 52, minWidth: 52 }} />
              {ordered.map((t, j) => (
                <th key={t} className="text-[8px] text-gray-500 font-mono font-normal align-bottom pb-1"
                  style={{ width: cell, minWidth: cell, height: 46 }}>
                  <div className="flex items-end justify-center h-full">
                    <span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }} className="truncate max-h-[42px]">{t}</span>
                  </div>
                  <div className="w-1.5 h-1.5 rounded-full mx-auto mt-0.5" style={{ background: bucketColor[bucketOf(t)] }} title={bucketOf(t)} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordered.map((rt, i) => (
              <tr key={rt}>
                <th className="sticky left-0 z-10 bg-[#0C1628] text-[9px] text-gray-300 font-mono font-medium text-right pr-1.5"
                  style={{ width: 52, minWidth: 52 }}>
                  <span className="inline-flex items-center gap-1 justify-end">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: bucketColor[bucketOf(rt)] }} />
                    {rt}
                  </span>
                </th>
                {ordered.map((ct, j) => {
                  const r = mat[i][j]
                  const isDiag = i === j
                  return (
                    <td key={ct}
                      title={`${rt} ↔ ${ct}: ${r.toFixed(2)}`}
                      className="text-center align-middle"
                      style={{
                        width: cell, minWidth: cell, height: cell,
                        background: isDiag ? "#1A2E52" : corrColor(r),
                        opacity: isDiag ? 0.5 : Math.max(0.35, Math.abs(r)),
                      }}>
                      {showNumbers && !isDiag && (
                        <span className="text-[8px] font-mono text-white/90">{r.toFixed(1)}</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bucket averages */}
      <div>
        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Correlation เฉลี่ยในแต่ละกลุ่ม</div>
        <div className="flex flex-wrap gap-1.5">
          {bucketStats.map(b => (
            <div key={b.bucket} className="flex items-center gap-1.5 bg-[#070B18] border border-[#1A2E52]/60 rounded-lg px-2 py-1">
              <span className="w-2 h-2 rounded-full" style={{ background: bucketColor[b.bucket] }} />
              <span className="text-[10px] text-gray-300 max-w-[120px] truncate">{b.bucket}</span>
              <span className="text-[10px] text-gray-600">({b.count})</span>
              <span className={cn("text-[10px] font-mono font-bold",
                isNaN(b.avg) ? "text-gray-600" : b.avg >= 0.6 ? "text-orange-400" : b.avg >= 0.4 ? "text-yellow-400" : "text-emerald-400")}>
                {isNaN(b.avg) ? "—" : b.avg.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Concentration warnings */}
      {hotPairs.length > 0 && (
        <div className="bg-red-500/5 border border-red-500/30 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-[11px] text-red-300 font-semibold mb-1">
            <AlertTriangle className="w-3.5 h-3.5" /> คู่ที่สัมพันธ์สูง (≥0.80) — เสี่ยงกระจุกตัว
          </div>
          <div className="flex flex-wrap gap-1.5">
            {hotPairs.slice(0, 10).map((p, i) => (
              <span key={i} className="text-[10px] font-mono bg-[#070B18] border border-red-500/20 rounded px-1.5 py-0.5 text-gray-300">
                {p.a}↔{p.b} <span className="text-red-400">{p.r.toFixed(2)}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
