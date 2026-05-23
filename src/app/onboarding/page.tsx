"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { TrendingUp, Play, Plus, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { usePortfolioStore } from "@/store/portfolioStore"
import { setOnboarded, savePositions, DEFAULT_SETTINGS, saveSettings, DEMO_POSITIONS } from "@/lib/portfolio"
import toast from "react-hot-toast"

type Step = "welcome" | "choice" | "setup" | "api" | "done"

export default function OnboardingPage() {
  const router = useRouter()
  const { updateSettings, setDemoMode } = usePortfolioStore()
  const [step, setStep] = useState<Step>("welcome")
  const [isDemo, setIsDemo] = useState(false)
  const [form, setForm] = useState({
    portfolioName: "Alpha Portfolio",
    ownerName: "",
    baseCurrency: "USD" as "USD" | "THB",
    startingCapital: "100000",
    finnhubKey: "",
    anthropicKey: "",
    exchangeRateKey: "",
  })

  function handleChoice(demo: boolean) {
    setIsDemo(demo)
    setStep("setup")
  }

  function handleSetup() {
    if (!form.ownerName.trim()) {
      toast.error("Please enter your name")
      return
    }
    setStep("api")
  }

  function handleFinish() {
    const settings = {
      ...DEFAULT_SETTINGS,
      portfolioName: form.portfolioName,
      ownerName: form.ownerName,
      baseCurrency: form.baseCurrency,
      startingCapital: parseFloat(form.startingCapital) || 100000,
      finnhubApiKey: form.finnhubKey,
      anthropicApiKey: form.anthropicKey,
      exchangeRateApiKey: form.exchangeRateKey,
      totalCashUSD: parseFloat(form.startingCapital) || 100000,
    }
    saveSettings(settings)
    updateSettings(settings)

    if (isDemo) {
      savePositions(DEMO_POSITIONS)
      setDemoMode(true)
      usePortfolioStore.setState({ positions: DEMO_POSITIONS })
    }

    setOnboarded()
    setStep("done")
    setTimeout(() => router.replace("/dashboard"), 1500)
  }

  return (
    <div className="min-h-screen bg-[#070B18] flex items-center justify-center p-4">
      <AnimatePresence mode="wait">
        {step === "welcome" && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center max-w-md"
          >
            <div className="w-20 h-20 rounded-2xl bg-[#00C2D4] flex items-center justify-center mx-auto mb-6">
              <TrendingUp className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-3">Alpha Dashboard</h1>
            <p className="text-gray-400 mb-8 text-lg">
              Your personal hedge fund management system. Track positions, analyze markets, and get AI-powered insights.
            </p>
            <Button
              onClick={() => setStep("choice")}
              className="bg-[#00C2D4] hover:bg-[#00A8BC] text-white px-8 py-3 text-base"
            >
              Get Started <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </motion.div>
        )}

        {step === "choice" && (
          <motion.div
            key="choice"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-lg"
          >
            <h2 className="text-2xl font-bold text-white text-center mb-2">How would you like to start?</h2>
            <p className="text-gray-400 text-center mb-8">You can always switch later in Settings</p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleChoice(true)}
                className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-6 text-left hover:border-[#00C2D4] transition-colors group"
              >
                <Play className="w-8 h-8 text-[#00D8EE] mb-3" />
                <div className="font-semibold text-white mb-1">Load Demo Portfolio</div>
                <div className="text-xs text-gray-400">
                  Pre-filled with NVDA, MSFT, TSM, AMD, PLTR, QQQI — explore all features instantly
                </div>
                <div className="mt-3 text-xs text-yellow-400 bg-yellow-500/10 rounded px-2 py-1">
                  DEMO MODE - clearly labeled
                </div>
              </button>
              <button
                onClick={() => handleChoice(false)}
                className="bg-[#0C1628] border border-[#1A2E52] rounded-xl p-6 text-left hover:border-[#00C2D4] transition-colors"
              >
                <Plus className="w-8 h-8 text-green-400 mb-3" />
                <div className="font-semibold text-white mb-1">Start Fresh</div>
                <div className="text-xs text-gray-400">
                  Empty portfolio — add your actual positions manually
                </div>
              </button>
            </div>
          </motion.div>
        )}

        {step === "setup" && (
          <motion.div
            key="setup"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md"
          >
            <h2 className="text-2xl font-bold text-white mb-6">Portfolio Setup</h2>
            <div className="space-y-4">
              <div>
                <Label>Your Name *</Label>
                <Input
                  placeholder="e.g. Somchai"
                  value={form.ownerName}
                  onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                  className="bg-[#1A2E52] border-[#1F3566] text-white mt-1"
                />
              </div>
              <div>
                <Label>Portfolio Name</Label>
                <Input
                  value={form.portfolioName}
                  onChange={(e) => setForm({ ...form, portfolioName: e.target.value })}
                  className="bg-[#1A2E52] border-[#1F3566] text-white mt-1"
                />
              </div>
              <div>
                <Label>Starting Capital (USD)</Label>
                <Input
                  type="number"
                  value={form.startingCapital}
                  onChange={(e) => setForm({ ...form, startingCapital: e.target.value })}
                  className="bg-[#1A2E52] border-[#1F3566] text-white mt-1"
                />
              </div>
              <div>
                <Label>Base Currency</Label>
                <div className="flex gap-2 mt-1">
                  {(["USD", "THB"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setForm({ ...form, baseCurrency: c })}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        form.baseCurrency === c
                          ? "bg-[#00C2D4] border-[#00C2D4] text-white"
                          : "bg-[#1A2E52] border-[#1F3566] text-gray-400"
                      }`}
                    >
                      {c === "USD" ? "🇺🇸 USD" : "🇹🇭 THB"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <Button
              onClick={handleSetup}
              className="w-full mt-6 bg-[#00C2D4] hover:bg-[#00A8BC]"
            >
              Continue <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </motion.div>
        )}

        {step === "api" && (
          <motion.div
            key="api"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md"
          >
            <h2 className="text-2xl font-bold text-white mb-2">API Keys</h2>
            <p className="text-gray-400 text-sm mb-6">
              Required for live data & AI features. All free to get. You can skip and add later in Settings.
            </p>
            <div className="space-y-4">
              <div>
                <Label className="text-gray-300">Finnhub API Key</Label>
                <p className="text-xs text-gray-500 mb-1">finnhub.io → free account → API Key</p>
                <Input
                  placeholder="d1abc..."
                  value={form.finnhubKey}
                  onChange={(e) => setForm({ ...form, finnhubKey: e.target.value })}
                  className="bg-[#1A2E52] border-[#1F3566] text-white font-mono text-sm"
                />
              </div>
              <div>
                <Label className="text-gray-300">Anthropic API Key</Label>
                <p className="text-xs text-gray-500 mb-1">console.anthropic.com → API Keys</p>
                <Input
                  placeholder="sk-ant-..."
                  type="password"
                  value={form.anthropicKey}
                  onChange={(e) => setForm({ ...form, anthropicKey: e.target.value })}
                  className="bg-[#1A2E52] border-[#1F3566] text-white font-mono text-sm"
                />
              </div>
              <div>
                <Label className="text-gray-300">ExchangeRate API Key (optional)</Label>
                <p className="text-xs text-gray-500 mb-1">exchangerate-api.com → free tier</p>
                <Input
                  placeholder="abc123..."
                  value={form.exchangeRateKey}
                  onChange={(e) => setForm({ ...form, exchangeRateKey: e.target.value })}
                  className="bg-[#1A2E52] border-[#1F3566] text-white font-mono text-sm"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" onClick={handleFinish} className="flex-1 border-[#1F3566] text-gray-300">
                Skip for now
              </Button>
              <Button onClick={handleFinish} className="flex-1 bg-[#00C2D4] hover:bg-[#00A8BC]">
                Launch Dashboard
              </Button>
            </div>
          </motion.div>
        )}

        {step === "done" && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">You&apos;re all set!</h2>
            <p className="text-gray-400">Launching your Alpha Dashboard...</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
