"use client"

import { AlertTriangle, Workflow } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  isAISemiDownstream, tightenStop, deRiskSizeMultiplier,
  type SupplyChainSnapshot,
} from "@/lib/supplyChain"

interface Props {
  ticker: string
  stop: number          // original swing stop
  price: number
  snap: SupplyChainSnapshot | null
}

/**
 * Shown only for downstream AI-semi names when the upstream bellwethers are
 * rolling over — surfaces a tighter stop + smaller size, per the de-risk rule.
 */
export function SupplyChainDeRiskBanner({ ticker, stop, price, snap }: Props) {
  if (!snap?.available || snap.deRiskLevel <= 0) return null
  if (!isAISemiDownstream(ticker)) return null
  if (!(stop > 0 && price > stop)) return null

  const tightened = tightenStop(stop, price, snap.deRiskLevel)
  const sizeMult = deRiskSizeMultiplier(snap.deRiskLevel)
  const origPct = ((stop - price) / price) * 100
  const newPct = ((tightened - price) / price) * 100

  return (
    <div className={cn(
      "rounded-xl border p-3 flex items-start gap-3",
      snap.regime === "BREAKING" ? "border-red-500/50 bg-red-500/10" : "border-orange-500/40 bg-orange-500/5",
    )}>
      <AlertTriangle className={cn("w-5 h-5 flex-shrink-0 mt-0.5", snap.regime === "BREAKING" ? "text-red-400" : "text-orange-400")} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
          <Workflow className="w-3.5 h-3.5 text-teal-400" />
          <span className={cn("text-sm font-bold", snap.regime === "BREAKING" ? "text-red-300" : "text-orange-300")}>
            Supply-Chain De-risk · {snap.regime}
          </span>
          <span className="text-[10px] text-gray-500">ต้นน้ำ score {snap.score}/100</span>
        </div>
        <div className="text-[11px] text-gray-300 leading-relaxed mb-2">
          {ticker} เป็นหุ้น AI/semi ปลายน้ำ · {snap.headline} — ลดความเสี่ยงตามต้นน้ำ
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#070B18] border border-[#1A2E52]/60 rounded-lg p-2">
            <div className="text-[9px] text-gray-500 uppercase tracking-wider">กระชับ Stop</div>
            <div className="text-sm font-mono font-bold text-orange-300">
              ${stop.toFixed(2)} → ${tightened.toFixed(2)}
            </div>
            <div className="text-[9px] text-gray-600">
              {origPct.toFixed(1)}% → {newPct.toFixed(1)}% (แคบลง)
            </div>
          </div>
          <div className="bg-[#070B18] border border-[#1A2E52]/60 rounded-lg p-2">
            <div className="text-[9px] text-gray-500 uppercase tracking-wider">ลดขนาดไม้</div>
            <div className="text-sm font-mono font-bold text-orange-300">{(sizeMult * 100).toFixed(0)}%</div>
            <div className="text-[9px] text-gray-600">ของไม้ปกติ</div>
          </div>
        </div>
      </div>
    </div>
  )
}
