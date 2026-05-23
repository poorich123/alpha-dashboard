"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getCompanyProfile } from "@/lib/finnhub"
import { usePortfolioStore } from "@/store/portfolioStore"
import type { Position } from "@/types"
import toast from "react-hot-toast"
import { InlineSpinner } from "@/components/ui/LoadingSpinner"

interface Props {
  open: boolean
  onClose: () => void
  editPosition?: Position | null
}

const CATEGORIES = [
  { value: "core", label: "💎 Core" },
  { value: "defensive", label: "🛡️ Defensive" },
  { value: "satellite", label: "🛸 Satellite" },
  { value: "speculative", label: "🎯 Speculative" },
  { value: "etf", label: "💰 ETF" },
  { value: "watchlist", label: "👀 Watchlist" },
]

const EXCHANGES = ["NASDAQ", "NYSE", "OTC"]

const EMPTY_FORM: Partial<Position> = {
  ticker: "",
  companyName: "",
  logoUrl: "",
  category: "core",
  shares: 0,
  avgCost: 0,
  currentPrice: 0,
  targetPrice: 0,
  stopLoss: 0,
  currency: "USD",
  exchange: "NASDAQ",
  sector: "",
  thesis: "",
  entryDate: new Date().toISOString().split("T")[0],
  tags: [],
  notes: "",
  isActive: true,
  alertEnabled: true,
}

export function AddPositionModal({ open, onClose, editPosition }: Props) {
  const { addPosition, updatePosition } = usePortfolioStore()
  const [fetching, setFetching] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState<Partial<Position>>(editPosition || EMPTY_FORM)

  // ── FIX: re-sync form with editPosition every time the modal opens ──
  // useState initializer only runs once. Without this effect the form
  // stays stuck on the first value (empty for "Add", or whatever the
  // first edited position was), causing Edit to appear blank/not save.
  useEffect(() => {
    if (open) {
      setForm(editPosition ? { ...editPosition } : { ...EMPTY_FORM, entryDate: new Date().toISOString().split("T")[0] })
    }
  }, [open, editPosition])

  async function fetchCompanyInfo() {
    if (!form.ticker) return
    setFetching(true)
    try {
      const profile = await getCompanyProfile(form.ticker.toUpperCase())
      if (profile.name) {
        setForm((f) => ({
          ...f,
          ticker: form.ticker!.toUpperCase(),
          companyName: profile.name,
          logoUrl: profile.logo || "",
          exchange: profile.exchange || "NASDAQ",
          sector: profile.finnhubIndustry || "",
          marketCap: profile.marketCapitalization,
        }))
        toast.success(`Found: ${profile.name}`)
      } else {
        toast.error("Company not found")
      }
    } catch {
      toast.error("Failed to fetch company info")
    } finally {
      setFetching(false)
    }
  }

  async function handleSave() {
    if (!form.ticker || !form.companyName) {
      toast.error("Ticker and company name required")
      return
    }
    if (!form.shares || !form.avgCost) {
      toast.error("Shares and cost basis required")
      return
    }

    setSaving(true)
    try {
      if (editPosition) {
        // Strip undefined fields so we don't wipe existing data
        const updates: Partial<Position> = {}
        ;(Object.keys(form) as (keyof Position)[]).forEach((k) => {
          const v = form[k]
          if (v !== undefined && v !== null && !Number.isNaN(v as number)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(updates as any)[k] = v
          }
        })
        // Ensure ticker stays uppercase
        if (updates.ticker) updates.ticker = (updates.ticker as string).toUpperCase()
        updatePosition(editPosition.id, updates)
        toast.success(`${updates.ticker || editPosition.ticker} updated`)
      } else {
        const position: Position = {
          id: crypto.randomUUID(),
          ticker: form.ticker!.toUpperCase(),
          companyName: form.companyName!,
          logoUrl: form.logoUrl || "",
          category: form.category as Position["category"] || "core",
          shares: Number(form.shares),
          avgCost: Number(form.avgCost),
          currentPrice: Number(form.currentPrice) || Number(form.avgCost),
          targetPrice: Number(form.targetPrice) || 0,
          stopLoss: Number(form.stopLoss) || 0,
          currency: "USD",
          exchange: form.exchange || "NASDAQ",
          sector: form.sector || "",
          thesis: form.thesis || "",
          entryDate: form.entryDate || new Date().toISOString().split("T")[0],
          tags: form.tags || [],
          notes: form.notes || "",
          isActive: true,
          alertEnabled: true,
        }
        addPosition(position)
        toast.success("Position added!")
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const f = (field: keyof Position, value: unknown) => setForm((prev) => ({ ...prev, [field]: value }))

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#0C1628] border-[#1A2E52] text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editPosition ? "Edit Position" : "Add Position"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          {/* Ticker */}
          <div className="col-span-2">
            <Label>Ticker Symbol</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={form.ticker || ""}
                onChange={(e) => f("ticker", e.target.value.toUpperCase())}
                placeholder="e.g. NVDA"
                className="bg-[#1A2E52] border-[#1F3566] text-white font-mono uppercase"
                onKeyDown={(e) => e.key === "Enter" && fetchCompanyInfo()}
              />
              <Button
                type="button"
                variant="outline"
                onClick={fetchCompanyInfo}
                disabled={fetching || !form.ticker}
                className="border-[#1F3566] whitespace-nowrap"
              >
                {fetching ? <InlineSpinner /> : "Fetch Info"}
              </Button>
            </div>
          </div>

          {/* Company Name + Logo */}
          <div className="col-span-2 flex items-center gap-3">
            {form.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.logoUrl} alt="" className="w-8 h-8 rounded" onError={(e) => (e.currentTarget.style.display = "none")} />
            )}
            <div className="flex-1">
              <Label>Company Name</Label>
              <Input
                value={form.companyName || ""}
                onChange={(e) => f("companyName", e.target.value)}
                className="bg-[#1A2E52] border-[#1F3566] text-white mt-1"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <Label>Category</Label>
            <Select value={form.category || "core"} onValueChange={(v) => f("category", v)}>
              <SelectTrigger className="bg-[#1A2E52] border-[#1F3566] text-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1A2E52] border-[#1F3566]">
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value} className="text-white hover:bg-[#1F3566]">
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Exchange */}
          <div>
            <Label>Exchange</Label>
            <Select value={form.exchange || "NASDAQ"} onValueChange={(v) => f("exchange", v)}>
              <SelectTrigger className="bg-[#1A2E52] border-[#1F3566] text-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1A2E52] border-[#1F3566]">
                {EXCHANGES.map((e) => (
                  <SelectItem key={e} value={e} className="text-white hover:bg-[#1F3566]">
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Shares */}
          <div>
            <Label>Number of Shares</Label>
            <Input
              type="number"
              value={form.shares || ""}
              onChange={(e) => f("shares", parseFloat(e.target.value))}
              className="bg-[#1A2E52] border-[#1F3566] text-white mt-1"
              min={0}
            />
          </div>

          {/* Avg Cost */}
          <div>
            <Label>Average Cost (USD)</Label>
            <Input
              type="number"
              value={form.avgCost || ""}
              onChange={(e) => f("avgCost", parseFloat(e.target.value))}
              className="bg-[#1A2E52] border-[#1F3566] text-white mt-1"
              step="0.01"
              min={0}
            />
          </div>

          {/* Target */}
          <div>
            <Label>Target Price (USD)</Label>
            <Input
              type="number"
              value={form.targetPrice || ""}
              onChange={(e) => f("targetPrice", parseFloat(e.target.value))}
              className="bg-[#1A2E52] border-[#1F3566] text-white mt-1"
              step="0.01"
              min={0}
            />
          </div>

          {/* Stop Loss */}
          <div>
            <Label>Stop Loss (USD)</Label>
            <Input
              type="number"
              value={form.stopLoss || ""}
              onChange={(e) => f("stopLoss", parseFloat(e.target.value))}
              className="bg-[#1A2E52] border-[#1F3566] text-white mt-1"
              step="0.01"
              min={0}
            />
          </div>

          {/* Sector */}
          <div>
            <Label>Sector</Label>
            <Input
              value={form.sector || ""}
              onChange={(e) => f("sector", e.target.value)}
              placeholder="e.g. Technology"
              className="bg-[#1A2E52] border-[#1F3566] text-white mt-1"
            />
          </div>

          {/* Entry Date */}
          <div>
            <Label>Entry Date</Label>
            <Input
              type="date"
              value={form.entryDate || ""}
              onChange={(e) => f("entryDate", e.target.value)}
              className="bg-[#1A2E52] border-[#1F3566] text-white mt-1"
            />
          </div>

          {/* Thesis */}
          <div className="col-span-2">
            <Label>Investment Thesis</Label>
            <Textarea
              value={form.thesis || ""}
              onChange={(e) => f("thesis", e.target.value)}
              placeholder="Why do you own this position?"
              rows={3}
              className="bg-[#1A2E52] border-[#1F3566] text-white mt-1 resize-none"
            />
          </div>

          {/* Notes */}
          <div className="col-span-2">
            <Label>Notes</Label>
            <Textarea
              value={form.notes || ""}
              onChange={(e) => f("notes", e.target.value)}
              placeholder="Additional notes..."
              rows={2}
              className="bg-[#1A2E52] border-[#1F3566] text-white mt-1 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <Button variant="outline" onClick={onClose} className="flex-1 border-[#1F3566] text-gray-300">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1 bg-[#00C2D4] hover:bg-[#00A8BC]">
            {saving ? <InlineSpinner /> : editPosition ? "Update" : "Add Position"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
