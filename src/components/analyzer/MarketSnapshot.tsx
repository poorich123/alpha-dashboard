"use client"

import type { MarketSnapshot as Snapshot } from "@/lib/stockAnalyzer"
import { format } from "date-fns"

interface Props {
  snapshot: Snapshot
}

export function MarketSnapshot({ snapshot }: Props) {
  const rows: { label: string; value: string; color?: string }[] = [
    { label: "Company",        value: snapshot.company },
    { label: "Current Price",  value: `$${snapshot.currentPrice.toFixed(2)}` },
    { label: "Previous Close", value: `$${snapshot.previousClose.toFixed(2)}` },
    {
      label: "Change",
      value: `$${snapshot.change.toFixed(2)} (${snapshot.changePct >= 0 ? "+" : ""}${snapshot.changePct.toFixed(2)}%)`,
      color: snapshot.changePct >= 0 ? "text-emerald-400" : "text-red-400",
    },
    { label: "Market Cap",     value: snapshot.marketCap },
    { label: "Exchange",       value: snapshot.exchange },
    { label: "Volume",         value: snapshot.volume },
    { label: "Open",           value: `$${snapshot.open.toFixed(2)}` },
    { label: "Day Range",      value: `$${snapshot.dayLow.toFixed(2)} – $${snapshot.dayHigh.toFixed(2)}` },
    { label: "52W Range",      value: `$${snapshot.week52Low.toFixed(2)} – $${snapshot.week52High.toFixed(2)}` },
    { label: "50DMA",          value: `$${snapshot.sma50.toFixed(2)}` },
    { label: "200DMA",         value: `$${snapshot.sma200.toFixed(2)}` },
    { label: "Quote As Of",    value: format(new Date(), "d MMM yyyy HH:mm:ss") },
  ]

  return (
    <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-4 hsr-card">
      <div className="text-xs text-gray-500 uppercase tracking-widest mb-3">Market Snapshot</div>
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between py-1.5 border-b border-[#1A2E52]/40 last:border-0">
            <span className="text-xs text-gray-500">{r.label}</span>
            <span className={`text-xs font-mono font-medium ${r.color ?? "text-white"}`}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

interface CompanyOverviewProps {
  snapshot: Snapshot
  business?: string  // company description (from Finnhub if available)
}

export function CompanyOverview({ snapshot, business }: CompanyOverviewProps) {
  return (
    <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-4 hsr-card">
      <div className="text-xs text-gray-500 uppercase tracking-widest mb-3">Company Overview</div>

      {business && (
        <>
          <div className="text-xs text-gray-500 mb-1">Business Summary</div>
          <p className="text-xs text-gray-300 leading-relaxed mb-3">{business}</p>
        </>
      )}

      <div className="text-xs text-gray-500 mb-2">Business</div>
      <div className="space-y-1">
        <Row label="Sector"   value={snapshot.sector} />
        <Row label="Industry" value={snapshot.industry} />
        <Row label="Country"  value={snapshot.country} />
        {snapshot.website && (
          <Row label="Website" value={
            <a href={snapshot.website} target="_blank" rel="noopener noreferrer" className="text-[#00D8EE] hover:underline truncate max-w-[160px] inline-block">
              {snapshot.website.replace(/^https?:\/\//, "")}
            </a>
          } />
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[#1A2E52]/40 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs text-white font-mono text-right">{value}</span>
    </div>
  )
}
