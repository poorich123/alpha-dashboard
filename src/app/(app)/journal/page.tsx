"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { BookOpen, Plus, Trash2, Save, X, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { HSRHeroBanner } from "@/components/hsr/HSRHeroBanner"
import { PAGE_CHARACTERS } from "@/components/hsr/characters"
import { usePortfolioStore } from "@/store/portfolioStore"
import { getTrades, addTrade, updateTrade, deleteTrade } from "@/lib/portfolio"
import type { Trade } from "@/types"
import { format, parseISO } from "date-fns"
import { cn } from "@/lib/utils"
import toast from "react-hot-toast"

// Preset setups = the signals this dashboard produces (so the journal links to them)
const SETUPS = [
  "Swing A/B @ support", "Fair Value buy (MoS)", "Conviction fund follow",
  "De-risk (technical)", "De-risk (thesis)", "Cut — stop hit", "Earnings event", "Other",
]
const ACTIONS: Trade["action"][] = ["buy", "add", "trim", "sell", "note"]

function actionStyle(a: Trade["action"]): string {
  if (a === "buy" || a === "add") return "text-emerald-300 bg-emerald-500/15 border-emerald-500/40"
  if (a === "sell" || a === "trim") return "text-red-300 bg-red-500/15 border-red-500/40"
  return "text-gray-400 bg-gray-700/30 border-gray-700"
}

export default function JournalPage() {
  const { positions } = usePortfolioStore()
  const character = PAGE_CHARACTERS.advisor  // Ruan Mei — reflection / review
  const [trades, setTrades] = useState<Trade[]>([])

  const reload = useCallback(() => {
    setTrades(getTrades().slice().sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)))
  }, [])
  useEffect(() => { reload() }, [reload])

  // ── Log form ──
  const [ticker, setTicker] = useState("")
  const [action, setAction] = useState<Trade["action"]>("buy")
  const [shares, setShares] = useState("")
  const [price, setPrice] = useState("")
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [setup, setSetup] = useState(SETUPS[0])
  const [rationale, setRationale] = useState("")
  const [pnl, setPnl] = useState("")

  const heldTickers = useMemo(
    () => Array.from(new Set(positions.filter(p => p.isActive).map(p => p.ticker.toUpperCase()))),
    [positions],
  )

  function prefillPrice(tk: string) {
    const pos = positions.find(p => p.ticker.toUpperCase() === tk.toUpperCase())
    if (pos) setPrice(String(pos.currentPrice))
  }

  function handleAdd() {
    const tk = ticker.trim().toUpperCase()
    if (!tk) { toast.error("ใส่ ticker ก่อน"); return }
    const sh = parseFloat(shares) || 0
    const pr = parseFloat(price) || 0
    if (action !== "note" && (sh <= 0 || pr <= 0)) { toast.error("ใส่ shares + price"); return }
    const t: Trade = {
      id: `j-${Date.now()}`,
      ticker: tk, action, shares: sh, price: pr, date,
      notes: "", setup, rationale: rationale.trim() || undefined,
      realizedPnL: pnl.trim() ? parseFloat(pnl) : undefined,
    }
    addTrade(t)
    toast.success(`บันทึก ${action.toUpperCase()} ${tk}`)
    setTicker(""); setShares(""); setPrice(""); setRationale(""); setPnl("")
    reload()
  }

  // ── Group by month ──
  const months = useMemo(() => {
    const map = new Map<string, Trade[]>()
    for (const t of trades) {
      const key = t.date.slice(0, 7)  // YYYY-MM
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(t)
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [trades])

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <HSRHeroBanner character={character} title="Trade Journal" height="h-40">
        <div className="text-[10px] tracking-[0.2em] uppercase font-semibold mb-1" style={{ color: character.color }}>
          Action Log · Review
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">Trade Journal</h1>
        <div className="text-xs text-gray-400">
          จดทุก action + สัญญาณที่ตาม → review รายเดือน · ปิด feedback loop ของระบบเทรด
        </div>
      </HSRHeroBanner>

      {/* ── Log form ── */}
      <div className="bg-[#0C1628] border border-[#1A2E52] rounded-2xl p-4 mb-5 hsr-card">
        <div className="flex items-center gap-2 mb-3">
          <Plus className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-bold text-white">บันทึก action ใหม่</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
          <div>
            <label className="text-[10px] text-gray-500">Ticker</label>
            <Input list="held-tickers" value={ticker}
              onChange={e => setTicker(e.target.value.toUpperCase())}
              onBlur={e => prefillPrice(e.target.value)}
              placeholder="NVDA" className="bg-[#070B18] border-[#1A2E52] text-white text-sm h-9 font-mono" />
            <datalist id="held-tickers">{heldTickers.map(t => <option key={t} value={t} />)}</datalist>
          </div>
          <div>
            <label className="text-[10px] text-gray-500">Action</label>
            <select value={action} onChange={e => setAction(e.target.value as Trade["action"])}
              className="w-full bg-[#070B18] border border-[#1A2E52] rounded-md text-white text-sm h-9 px-2">
              {ACTIONS.map(a => <option key={a} value={a}>{a.toUpperCase()}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-gray-500">Shares</label>
            <Input type="number" value={shares} onChange={e => setShares(e.target.value)}
              placeholder="0" className="bg-[#070B18] border-[#1A2E52] text-white text-sm h-9 font-mono" />
          </div>
          <div>
            <label className="text-[10px] text-gray-500">Price $</label>
            <Input type="number" value={price} onChange={e => setPrice(e.target.value)}
              placeholder="0.00" className="bg-[#070B18] border-[#1A2E52] text-white text-sm h-9 font-mono" />
          </div>
          <div>
            <label className="text-[10px] text-gray-500">Date</label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="bg-[#070B18] border-[#1A2E52] text-white text-sm h-9" />
          </div>
          <div>
            <label className="text-[10px] text-gray-500">สัญญาณที่ตาม (setup)</label>
            <select value={setup} onChange={e => setSetup(e.target.value)}
              className="w-full bg-[#070B18] border border-[#1A2E52] rounded-md text-white text-sm h-9 px-2">
              {SETUPS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {(action === "sell" || action === "trim") && (
            <div>
              <label className="text-[10px] text-gray-500">Realized P&L $ (option)</label>
              <Input type="number" value={pnl} onChange={e => setPnl(e.target.value)}
                placeholder="+/-" className="bg-[#070B18] border-[#1A2E52] text-white text-sm h-9 font-mono" />
            </div>
          )}
          <div className="col-span-2 md:col-span-1 flex items-end">
            <Button onClick={handleAdd} className="bg-emerald-500/80 hover:bg-emerald-500 w-full h-9 gap-1">
              <Save className="w-3.5 h-3.5" /> บันทึก
            </Button>
          </div>
        </div>
        <Input value={rationale} onChange={e => setRationale(e.target.value)}
          placeholder="เหตุผล / rationale (ทำไมเข้า-ออกตอนนี้)…"
          className="bg-[#070B18] border-[#1A2E52] text-white text-sm h-9" />
      </div>

      {/* ── Entries by month ── */}
      {trades.length === 0 ? (
        <div className="text-center py-12 text-gray-500">ยังไม่มีบันทึก — log action แรกด้านบน</div>
      ) : (
        <div className="space-y-5">
          {months.map(([month, items]) => (
            <MonthBlock key={month} month={month} items={items} onChange={reload} />
          ))}
        </div>
      )}
    </div>
  )
}

function MonthBlock({ month, items, onChange }: { month: string; items: Trade[]; onChange: () => void }) {
  const closed = items.filter(t => (t.action === "sell" || t.action === "trim") && t.realizedPnL != null)
  const realized = closed.reduce((s, t) => s + (t.realizedPnL || 0), 0)
  const wins = closed.filter(t => (t.realizedPnL || 0) > 0).length
  const winRate = closed.length > 0 ? (wins / closed.length) * 100 : null

  return (
    <div>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="text-sm font-bold text-white">{format(parseISO(month + "-01"), "MMMM yyyy")}</div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-gray-500">{items.length} actions</span>
          {winRate != null && <span className="text-gray-400">Win {winRate.toFixed(0)}% ({closed.length})</span>}
          {closed.length > 0 && (
            <span className={cn("font-mono font-bold", realized >= 0 ? "text-emerald-400" : "text-red-400")}>
              {realized >= 0 ? "+" : ""}${realized.toFixed(0)} realized
            </span>
          )}
        </div>
      </div>
      <div className="space-y-2">
        {items.map(t => <JournalRow key={t.id} t={t} onChange={onChange} />)}
      </div>
    </div>
  )
}

function JournalRow({ t, onChange }: { t: Trade; onChange: () => void }) {
  const [editing, setEditing] = useState(false)
  const [review, setReview] = useState(t.review || "")
  const [rating, setRating] = useState(t.rating || 0)

  function saveReview() {
    updateTrade(t.id, { review: review.trim() || undefined, rating: rating || undefined })
    setEditing(false); onChange(); toast.success("อัปเดต review")
  }
  function remove() {
    if (confirm(`ลบบันทึก ${t.action.toUpperCase()} ${t.ticker}?`)) { deleteTrade(t.id); onChange() }
  }

  return (
    <div className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", actionStyle(t.action))}>
            {t.action.toUpperCase()}
          </span>
          <span className="text-white font-bold font-mono">{t.ticker}</span>
          {t.action !== "note" && (
            <span className="text-xs text-gray-400 font-mono">{t.shares} @ ${t.price.toFixed(2)}</span>
          )}
          {t.setup && <span className="text-[10px] text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 rounded px-1.5 py-0.5">{t.setup}</span>}
          {t.realizedPnL != null && (
            <span className={cn("text-[11px] font-mono font-bold", t.realizedPnL >= 0 ? "text-emerald-400" : "text-red-400")}>
              {t.realizedPnL >= 0 ? "+" : ""}${t.realizedPnL.toFixed(0)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[10px] text-gray-600">{t.date}</span>
          <button onClick={() => setEditing(v => !v)} className="text-gray-500 hover:text-cyan-300 text-[10px] px-1">review</button>
          <button onClick={remove} className="text-gray-600 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      {t.rationale && <div className="text-[11px] text-gray-400 mt-1.5">💭 {t.rationale}</div>}
      {t.review && !editing && (
        <div className="text-[11px] text-amber-200/80 mt-1 flex items-center gap-1.5">
          📝 {t.review}
          {t.rating ? <span className="text-amber-400">{"★".repeat(t.rating)}</span> : null}
        </div>
      )}
      {editing && (
        <div className="mt-2 space-y-2 border-t border-[#1A2E52] pt-2">
          <Input value={review} onChange={e => setReview(e.target.value)}
            placeholder="บทเรียน / สิ่งที่ได้เรียนรู้จากไม้นี้…"
            className="bg-[#070B18] border-[#1A2E52] text-white text-xs h-8" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-500 mr-1">ให้คะแนนการ execute:</span>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setRating(n)}>
                  <Star className={cn("w-4 h-4", n <= rating ? "text-amber-400 fill-amber-400" : "text-gray-600")} />
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              <Button size="sm" onClick={saveReview} className="h-7 bg-amber-500/70 hover:bg-amber-500 text-xs gap-1"><Save className="w-3 h-3" /> Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="h-7 text-gray-400"><X className="w-3 h-3" /></Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
