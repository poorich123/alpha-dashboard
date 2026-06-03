"use client"

import { Waves, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { BubbleScoreResult } from "@/lib/bubbleScore"

interface Props {
  result: BubbleScoreResult | null
}

function barColor(score: number): string {
  if (score >= 78) return "bg-red-500"
  if (score >= 62) return "bg-orange-500"
  if (score >= 45) return "bg-yellow-500"
  if (score >= 25) return "bg-green-500"
  return "bg-emerald-500"
}

export function BubbleScoreCard({ result }: Props) {
  if (!result || !result.available) return null

  return (
    <div className="bg-[#0C1628] border border-[#1A2E52] rounded-2xl overflow-hidden hsr-card">
      {/* Header */}
      <div className="bg-[#0A1424] border-b border-[#1A2E52] px-4 py-3 flex items-center gap-2">
        <Waves className="w-4 h-4 text-sky-400" />
        <div>
          <div className="text-sm font-bold text-white">Bubble Score · Dalio 6-Point</div>
          <div className="text-[10px] text-gray-500">
            ความเสี่ยงฟองสบู่รายตัว (ปรับจากกรอบ Ray Dalio) · สูง = ร้อนแรง/เสี่ยงไล่ราคา
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Overall hero */}
        <div className={cn(
          "rounded-xl border p-4 flex items-center gap-4 flex-wrap",
          result.overall >= 62 ? "border-red-500/40 bg-red-500/5" :
          result.overall >= 45 ? "border-yellow-500/40 bg-yellow-500/5" :
          "border-emerald-500/40 bg-emerald-500/5",
        )}>
          <div className="text-center">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Bubble</div>
            <div className={cn("text-3xl font-bold font-mono", result.color)}>{result.overall}</div>
            <div className="text-[10px] text-gray-600">/100</div>
          </div>
          <div className="flex-1 min-w-[160px]">
            <div className={cn("text-sm font-bold mb-1", result.color)}>{result.level}</div>
            <div className="text-[11px] text-gray-400 leading-relaxed">{result.summary}</div>
          </div>
        </div>

        {/* 6 gauges */}
        <div className="space-y-2.5">
          {result.gauges.map(g => (
            <div key={g.key}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[11px] text-gray-300">{g.label}</span>
                <span className="text-[11px] font-mono text-gray-400">{Math.round(g.score)}</span>
              </div>
              <div className="h-1.5 bg-[#1A2E52] rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", barColor(g.score))} style={{ width: `${Math.round(g.score)}%` }} />
              </div>
              <div className="text-[9px] text-gray-600 mt-0.5">{g.note}</div>
            </div>
          ))}
        </div>

        <div className="text-[10px] text-gray-600 leading-relaxed flex items-start gap-1.5">
          <AlertTriangle className="w-3 h-3 text-gray-600 mt-0.5 flex-shrink-0" />
          <span>
            กรอบ Dalio เดิมใช้ระดับตลาด — ปรับมาใช้รายหุ้น (ข้อ 5 เลเวอเรจเป็น proxy จาก β + ความผันผวน) ·
            ไม่ใช่คำแนะนำลงทุน
          </span>
        </div>
      </div>
    </div>
  )
}
