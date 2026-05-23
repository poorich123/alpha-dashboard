/**
 * Market Regime Detector
 * ──────────────────────
 * Real-time market regime classification based on VIX, SPY trend, RSI, and breadth.
 * Inspired by Stanley Druckenmiller + Mark Minervini macro frameworks.
 *
 * Regimes:
 *  • RISK-ON BULL  — VIX <18, SPY in confirmed uptrend, RSI 50-70
 *  • NEUTRAL       — Mixed signals, range-bound
 *  • CAUTION       — VIX rising, trend weakening
 *  • RISK-OFF BEAR — VIX >25, SPY below 200DMA
 *  • PANIC         — VIX >35, sharp decline
 */

import { getYahooCandles } from "./yfinance"
import { calculateRSI, calculateEMA } from "./technical"

export type RegimeLabel =
  | "RISK-ON BULL"
  | "NEUTRAL"
  | "CAUTION"
  | "RISK-OFF BEAR"
  | "PANIC"

export interface MarketRegime {
  regime: RegimeLabel
  score: number   // 0-100 (100 = max risk-on)
  vix: {
    level: number
    label: "Complacent" | "Calm" | "Uncertain" | "Fearful" | "Panic"
    color: string
  }
  spy: {
    price: number
    ema50: number
    ema200: number
    aboveEma50: boolean
    aboveEma200: boolean
    rsi: number
    change5d: number
    change20d: number
  }
  qqq: {
    rsi: number
    change20d: number
  }
  tlt: {
    change20d: number  // bonds — flight to safety indicator
  }
  signals: {
    label: string
    status: "bullish" | "bearish" | "neutral"
    detail: string
  }[]
  summary: string
  positionGuidance: {
    maxExposure: number   // 0-100% of portfolio
    cashTarget: number    // recommended cash %
    bias: "AGGRESSIVE" | "GROWTH" | "BALANCED" | "DEFENSIVE" | "CASH"
  }
  scannedAt: number
}

// ─── VIX classification ──────────────────────────────────────────────────────

function classifyVIX(vix: number) {
  if (vix < 13) return { label: "Complacent" as const, color: "#f97316" }  // too low = complacent (dangerous!)
  if (vix < 18) return { label: "Calm"       as const, color: "#22c55e" }
  if (vix < 25) return { label: "Uncertain"  as const, color: "#eab308" }
  if (vix < 35) return { label: "Fearful"    as const, color: "#f97316" }
  return            { label: "Panic"      as const, color: "#ef4444" }
}

// ─── Main detector ───────────────────────────────────────────────────────────

export async function detectMarketRegime(): Promise<MarketRegime | null> {
  try {
    // Fetch all in parallel
    const [vixCandle, spyCandle, qqqCandle, tltCandle] = await Promise.all([
      getYahooCandles("^VIX", "3mo", "1d").catch(() => null),
      getYahooCandles("SPY",  "1y",  "1d").catch(() => null),
      getYahooCandles("QQQ",  "3mo", "1d").catch(() => null),
      getYahooCandles("TLT",  "3mo", "1d").catch(() => null),
    ])

    if (!spyCandle || spyCandle.c.length < 200) return null

    // ── VIX ──
    const vixLevel = vixCandle?.c[vixCandle.c.length - 1] ?? 20
    const vixInfo = classifyVIX(vixLevel)

    // ── SPY ──
    const spyCloses = spyCandle.c
    const spyPrice  = spyCloses[spyCloses.length - 1]
    const ema50arr  = calculateEMA(spyCloses, 50)
    const ema200arr = calculateEMA(spyCloses, 200)
    const ema50     = ema50arr[ema50arr.length - 1] || spyPrice
    const ema200    = ema200arr[ema200arr.length - 1] || spyPrice
    const spyRsi    = calculateRSI(spyCloses)
    const spyChange5d  = spyCloses.length >= 6
      ? ((spyPrice - spyCloses[spyCloses.length - 6]) / spyCloses[spyCloses.length - 6]) * 100 : 0
    const spyChange20d = spyCloses.length >= 21
      ? ((spyPrice - spyCloses[spyCloses.length - 22]) / spyCloses[spyCloses.length - 22]) * 100 : 0

    const aboveEma50  = spyPrice > ema50
    const aboveEma200 = spyPrice > ema200

    // ── QQQ ──
    const qqqRsi = qqqCandle ? calculateRSI(qqqCandle.c) : 50
    const qqqCloses = qqqCandle?.c || []
    const qqqChange20d = qqqCloses.length >= 21
      ? ((qqqCloses[qqqCloses.length - 1] - qqqCloses[qqqCloses.length - 22]) / qqqCloses[qqqCloses.length - 22]) * 100 : 0

    // ── TLT (bonds) ──
    const tltCloses = tltCandle?.c || []
    const tltChange20d = tltCloses.length >= 21
      ? ((tltCloses[tltCloses.length - 1] - tltCloses[tltCloses.length - 22]) / tltCloses[tltCloses.length - 22]) * 100 : 0

    // ── Compute composite score (0-100, higher = risk-on) ──
    let score = 50

    // VIX contribution (-20 to +25)
    if (vixLevel < 13)      score -= 5   // too complacent = warning
    else if (vixLevel < 18) score += 25  // calm
    else if (vixLevel < 25) score += 5
    else if (vixLevel < 35) score -= 15
    else                    score -= 25

    // SPY trend contribution (-25 to +25)
    if (aboveEma50 && aboveEma200) score += 20
    else if (aboveEma200)          score += 5
    else if (!aboveEma50 && !aboveEma200) score -= 25
    else                           score -= 10

    // SPY RSI contribution (-10 to +10)
    if (spyRsi >= 50 && spyRsi <= 70) score += 10
    else if (spyRsi >= 40 && spyRsi < 50) score += 0
    else if (spyRsi < 40)  score -= 10
    else if (spyRsi > 75)  score -= 5  // overbought

    // QQQ momentum
    if (qqqChange20d > 5)       score += 5
    else if (qqqChange20d < -5) score -= 5

    // Bond flight-to-safety: TLT rising fast = stocks falling
    if (tltChange20d > 5)       score -= 5
    else if (tltChange20d < -5) score += 3

    score = Math.max(0, Math.min(100, score))

    // ── Determine regime ──
    let regime: RegimeLabel
    if (vixLevel >= 35)                          regime = "PANIC"
    else if (score >= 75 && vixLevel < 18)       regime = "RISK-ON BULL"
    else if (score >= 55)                        regime = "NEUTRAL"
    else if (score >= 35)                        regime = "CAUTION"
    else                                          regime = "RISK-OFF BEAR"

    // ── Build signal list ──
    const signals: MarketRegime["signals"] = []

    signals.push({
      label: "VIX Volatility",
      status: vixLevel < 18 ? "bullish" : vixLevel < 25 ? "neutral" : "bearish",
      detail: `VIX at ${vixLevel.toFixed(2)} — ${vixInfo.label}`,
    })

    signals.push({
      label: "SPY Trend",
      status: aboveEma50 && aboveEma200 ? "bullish" : (!aboveEma50 && !aboveEma200) ? "bearish" : "neutral",
      detail: `SPY $${spyPrice.toFixed(2)} ${aboveEma50 ? "↑" : "↓"} EMA50 ($${ema50.toFixed(2)}) · ${aboveEma200 ? "↑" : "↓"} EMA200 ($${ema200.toFixed(2)})`,
    })

    signals.push({
      label: "SPY Momentum",
      status: spyRsi >= 50 && spyRsi <= 70 ? "bullish" : spyRsi < 40 ? "bearish" : "neutral",
      detail: `RSI ${spyRsi.toFixed(1)} · 5d ${spyChange5d >= 0 ? "+" : ""}${spyChange5d.toFixed(2)}% · 20d ${spyChange20d >= 0 ? "+" : ""}${spyChange20d.toFixed(2)}%`,
    })

    signals.push({
      label: "Tech (QQQ)",
      status: qqqRsi >= 50 && qqqChange20d > 0 ? "bullish" : qqqChange20d < -3 ? "bearish" : "neutral",
      detail: `QQQ RSI ${qqqRsi.toFixed(1)} · 20d ${qqqChange20d >= 0 ? "+" : ""}${qqqChange20d.toFixed(2)}%`,
    })

    signals.push({
      label: "Bonds (TLT)",
      status: tltChange20d < -2 ? "bullish" : tltChange20d > 5 ? "bearish" : "neutral",
      detail: `TLT 20d ${tltChange20d >= 0 ? "+" : ""}${tltChange20d.toFixed(2)}% — ${tltChange20d > 5 ? "flight to safety" : "risk-on flows"}`,
    })

    // ── Summary (Thai) ──
    const summaries: Record<RegimeLabel, string> = {
      "RISK-ON BULL":  "ตลาดอยู่ในขาขึ้นแข็งแกร่ง · เปิด long positions ได้เต็มที่ · ใช้ swing trade strategy ได้",
      "NEUTRAL":       "ตลาดเคลื่อนไหวในกรอบ · เปิด long แบบเลือกตัว · เก็บเงินสดบางส่วน",
      "CAUTION":       "สัญญาณอ่อนแรง · ลดการเปิด position ใหม่ · เพิ่มเงินสด · ตรวจ stop loss",
      "RISK-OFF BEAR": "ตลาดอยู่ในขาลง · ลดความเสี่ยง · ถือเงินสด >25% · พิจารณา defensive sectors",
      "PANIC":         "PANIC MODE · ห้ามไล่ราคา · ถือเงินสด >50% · รอ FTD signal ก่อนเข้าใหม่",
    }

    // ── Position sizing guidance ──
    const guidance: MarketRegime["positionGuidance"] = (() => {
      if (regime === "RISK-ON BULL")  return { maxExposure: 95, cashTarget: 5,  bias: "AGGRESSIVE" }
      if (regime === "NEUTRAL")       return { maxExposure: 80, cashTarget: 20, bias: "GROWTH" }
      if (regime === "CAUTION")       return { maxExposure: 65, cashTarget: 35, bias: "BALANCED" }
      if (regime === "RISK-OFF BEAR") return { maxExposure: 40, cashTarget: 60, bias: "DEFENSIVE" }
      return                                 { maxExposure: 20, cashTarget: 80, bias: "CASH" }
    })()

    return {
      regime,
      score,
      vix: { level: vixLevel, label: vixInfo.label, color: vixInfo.color },
      spy: {
        price: spyPrice, ema50, ema200,
        aboveEma50, aboveEma200,
        rsi: spyRsi,
        change5d: spyChange5d, change20d: spyChange20d,
      },
      qqq: { rsi: qqqRsi, change20d: qqqChange20d },
      tlt: { change20d: tltChange20d },
      signals,
      summary: summaries[regime],
      positionGuidance: guidance,
      scannedAt: Date.now(),
    }
  } catch (err) {
    console.error("[marketRegime]", err)
    return null
  }
}
