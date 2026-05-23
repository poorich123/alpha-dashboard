"use client"

import { useState } from "react"
import { Save, Download, Upload, Trash2, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { usePortfolioStore } from "@/store/portfolioStore"
import { exportPortfolio, importPortfolio, clearAllData, DEMO_POSITIONS, savePositions } from "@/lib/portfolio"
import { clearCache } from "@/lib/finnhub"
import toast from "react-hot-toast"
import type { PortfolioSettings } from "@/types"

export default function SettingsPage() {
  const { settings, updateSettings, setPositions, setDemoMode } = usePortfolioStore()
  const [localSettings, setLocalSettings] = useState<PortfolioSettings>({ ...settings })
  const [showFinnhub, setShowFinnhub] = useState(false)
  const [showAnthropic, setShowAnthropic] = useState(false)

  function handleSave() {
    updateSettings(localSettings)
    // Clear API cache so next fetch uses new keys immediately
    clearCache()
    toast.success("Settings saved! Refreshing data with new keys...")
  }

  function handleExport() {
    const json = exportPortfolio()
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `alpha-portfolio-${new Date().toISOString().split("T")[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Portfolio exported!")
  }

  function handleImport() {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json"
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          importPortfolio(ev.target?.result as string)
          window.location.reload()
          toast.success("Portfolio imported!")
        } catch {
          toast.error("Invalid portfolio file")
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  function handleClearData() {
    if (confirm("This will delete ALL portfolio data. Are you sure?")) {
      clearAllData()
      window.location.reload()
    }
  }

  function handleLoadDemo() {
    savePositions(DEMO_POSITIONS)
    setPositions(DEMO_POSITIONS)
    setDemoMode(true)
    toast.success("Demo portfolio loaded!")
  }

  const f = <K extends keyof PortfolioSettings>(key: K, value: PortfolioSettings[K]) =>
    setLocalSettings((prev) => ({ ...prev, [key]: value }))

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <Button onClick={handleSave} className="bg-[#00C2D4] hover:bg-[#00A8BC]">
          <Save className="w-4 h-4 mr-1" /> Save
        </Button>
      </div>

      <div className="space-y-6">
        {/* Portfolio Identity */}
        <section className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-5">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-4">Portfolio Identity</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Portfolio Name</Label>
              <Input
                value={localSettings.portfolioName}
                onChange={(e) => f("portfolioName", e.target.value)}
                className="bg-[#1A2E52] border-[#1F3566] text-white mt-1"
              />
            </div>
            <div>
              <Label>Owner Name</Label>
              <Input
                value={localSettings.ownerName}
                onChange={(e) => f("ownerName", e.target.value)}
                className="bg-[#1A2E52] border-[#1F3566] text-white mt-1"
              />
            </div>
            <div>
              <Label>Starting Capital (USD)</Label>
              <Input
                type="number"
                value={localSettings.startingCapital}
                onChange={(e) => f("startingCapital", parseFloat(e.target.value))}
                className="bg-[#1A2E52] border-[#1F3566] text-white mt-1"
              />
            </div>
            <div>
              <Label>Monthly Contribution (USD)</Label>
              <Input
                type="number"
                value={localSettings.monthlyContribution}
                onChange={(e) => f("monthlyContribution", parseFloat(e.target.value))}
                className="bg-[#1A2E52] border-[#1F3566] text-white mt-1"
              />
            </div>
            <div>
              <Label>Cash Available (USD)</Label>
              <Input
                type="number"
                value={localSettings.totalCashUSD}
                onChange={(e) => f("totalCashUSD", parseFloat(e.target.value))}
                className="bg-[#1A2E52] border-[#1F3566] text-white mt-1"
              />
            </div>
            <div>
              <Label>Inception Date</Label>
              <Input
                type="date"
                value={localSettings.inceptionDate}
                onChange={(e) => f("inceptionDate", e.target.value)}
                className="bg-[#1A2E52] border-[#1F3566] text-white mt-1"
              />
            </div>
          </div>

          <div className="mt-4">
            <Label>Risk Tolerance: {localSettings.riskTolerance}/5</Label>
            <Slider
              value={[localSettings.riskTolerance]}
              min={1}
              max={5}
              step={1}
              onValueChange={([v]) => f("riskTolerance", v as 1 | 2 | 3 | 4 | 5)}
              className="mt-2"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Conservative</span>
              <span>Balanced</span>
              <span>Aggressive</span>
            </div>
          </div>
        </section>

        {/* Target Allocations */}
        <section className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-5">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-4">Target Allocations (%)</div>
          <div className="space-y-3">
            {Object.entries(localSettings.targetAllocation).map(([cat, val]) => (
              <div key={cat}>
                <div className="flex justify-between mb-1">
                  <Label className="capitalize text-gray-300">{cat}</Label>
                  <span className="text-white text-sm font-medium">{val}%</span>
                </div>
                <Slider
                  value={[val]}
                  min={0}
                  max={60}
                  step={5}
                  onValueChange={([v]) => f("targetAllocation", { ...localSettings.targetAllocation, [cat]: v })}
                />
              </div>
            ))}
            <div className="text-xs text-gray-500 mt-2">
              Total: {Object.values(localSettings.targetAllocation).reduce((a, b) => a + b, 0)}%
              {Object.values(localSettings.targetAllocation).reduce((a, b) => a + b, 0) !== 100 && (
                <span className="text-yellow-400 ml-2">(should be 100%)</span>
              )}
            </div>
          </div>
        </section>

        {/* API Keys */}
        <section className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-5">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-4">API Configuration</div>
          <div className="space-y-4">
            <div>
              <Label>Finnhub API Key</Label>
              <p className="text-xs text-gray-500 mb-1">Get free key at finnhub.io</p>
              <div className="flex gap-2">
                <Input
                  type={showFinnhub ? "text" : "password"}
                  value={localSettings.finnhubApiKey}
                  onChange={(e) => f("finnhubApiKey", e.target.value)}
                  placeholder="d1abc..."
                  className="bg-[#1A2E52] border-[#1F3566] text-white font-mono text-sm"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFinnhub(!showFinnhub)}
                  className="text-gray-400"
                >
                  {showFinnhub ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div>
              <Label>Anthropic API Key</Label>
              <p className="text-xs text-gray-500 mb-1">Get at console.anthropic.com</p>
              <div className="flex gap-2">
                <Input
                  type={showAnthropic ? "text" : "password"}
                  value={localSettings.anthropicApiKey}
                  onChange={(e) => f("anthropicApiKey", e.target.value)}
                  placeholder="sk-ant-..."
                  className="bg-[#1A2E52] border-[#1F3566] text-white font-mono text-sm"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAnthropic(!showAnthropic)}
                  className="text-gray-400"
                >
                  {showAnthropic ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div>
              <Label>ExchangeRate API Key</Label>
              <p className="text-xs text-gray-500 mb-1">exchangerate-api.com (free tier)</p>
              <Input
                type="password"
                value={localSettings.exchangeRateApiKey}
                onChange={(e) => f("exchangeRateApiKey", e.target.value)}
                placeholder="abc123..."
                className="bg-[#1A2E52] border-[#1F3566] text-white font-mono text-sm"
              />
            </div>
          </div>
        </section>

        {/* Display Preferences */}
        <section className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-5">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-4">Display Preferences</div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Show THB Values</Label>
                <p className="text-xs text-gray-500">Display portfolio in Thai Baht alongside USD</p>
              </div>
              <Switch
                checked={localSettings.showTHB}
                onCheckedChange={(v) => f("showTHB", v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Stop Loss Alerts</Label>
                <p className="text-xs text-gray-500">Alert when positions approach stop loss</p>
              </div>
              <Switch
                checked={localSettings.alertStopLoss}
                onCheckedChange={(v) => f("alertStopLoss", v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Earnings Reminders</Label>
                <p className="text-xs text-gray-500">Notify before earnings dates</p>
              </div>
              <Switch
                checked={localSettings.alertEarnings}
                onCheckedChange={(v) => f("alertEarnings", v)}
              />
            </div>
          </div>
        </section>

        {/* Data Management */}
        <section className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-5">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-4">Data Management</div>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={handleExport}
              className="border-[#1F3566] text-gray-300 hover:bg-[#1A2E52]"
            >
              <Download className="w-4 h-4 mr-1" /> Export JSON
            </Button>
            <Button
              variant="outline"
              onClick={handleImport}
              className="border-[#1F3566] text-gray-300 hover:bg-[#1A2E52]"
            >
              <Upload className="w-4 h-4 mr-1" /> Import JSON
            </Button>
            <Button
              variant="outline"
              onClick={handleLoadDemo}
              className="border-[#1F3566] text-yellow-400 hover:bg-[#1A2E52]"
            >
              Load Demo Data
            </Button>
            <Button
              variant="outline"
              onClick={handleClearData}
              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="w-4 h-4 mr-1" /> Clear All Data
            </Button>
          </div>
        </section>

        <Button onClick={handleSave} className="w-full bg-[#00C2D4] hover:bg-[#00A8BC]">
          <Save className="w-4 h-4 mr-1" /> Save All Settings
        </Button>
      </div>
    </div>
  )
}
