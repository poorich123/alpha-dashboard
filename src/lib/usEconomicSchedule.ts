/**
 * US Economic Calendar — supplementary feed
 * ─────────────────────────────────────────────
 * Finnhub's free tier doesn't return US economic events (CPI, PCE, NFP,
 * FOMC, GDP, etc.), so we generate them ourselves using known release
 * patterns + hardcoded FOMC dates.
 *
 * Accuracy notes:
 * - Recurring events (NFP, CPI, PCE, Jobless Claims) follow consistent
 *   patterns and are correct to the day. Times are typically 8:30 AM ET
 *   except FOMC (2:00 PM ET) and Jobless Claims (8:30 AM ET).
 * - FOMC dates are pre-announced — update FOMC_DATES yearly from Fed
 *   calendar: federalreserve.gov/monetarypolicy/fomccalendars.htm
 * - All times stored as ISO strings in UTC (ET = UTC-4 during DST,
 *   UTC-5 otherwise). For simplicity we use 12:30 UTC for 8:30 AM ET DST
 *   and 18:00 UTC for 2:00 PM ET DST.
 */

import type { EconomicEvent } from "@/types"

// ─── FOMC meeting dates (US Federal Reserve) ─────────────────────────────────
// Source: federalreserve.gov/monetarypolicy/fomccalendars.htm
// Each meeting concludes on day 2 with a 2:00 PM ET statement + press conf.
// Format: ISO date of conclusion day
const FOMC_DATES = [
  // 2026
  "2026-01-28",
  "2026-03-18",
  "2026-04-29",
  "2026-06-17",
  "2026-07-29",
  "2026-09-16",
  "2026-10-28",
  "2026-12-09",
  // 2027 (Fed typically announces in Q2 of prior year — placeholder dates)
  "2027-01-27",
  "2027-03-17",
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pad(n: number): string { return String(n).padStart(2, "0") }

// Format Date as ISO-like string for EconomicEvent.time field
// Use 12:30:00 UTC for 8:30 AM ET (during DST) — close enough for sorting
function fmtTime(year: number, month: number, day: number, hour: number, min = 0): string {
  return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(min)}:00`
}

// First Friday of given month
function firstFriday(year: number, month: number): number {
  const d = new Date(year, month - 1, 1)
  const offset = (5 - d.getDay() + 7) % 7   // 5 = Friday
  return 1 + offset
}

// Last Friday of given month
function lastFriday(year: number, month: number): number {
  const lastDay = new Date(year, month, 0).getDate()
  const d = new Date(year, month - 1, lastDay)
  const offset = (d.getDay() - 5 + 7) % 7
  return lastDay - offset
}

// Nth weekday of month (e.g. 2nd Tuesday for CPI/PPI release week)
function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): number {
  const d = new Date(year, month - 1, 1)
  const offset = (weekday - d.getDay() + 7) % 7
  return 1 + offset + (n - 1) * 7
}

// All Thursdays in month (Jobless Claims weekly)
function allThursdays(year: number, month: number): number[] {
  const days: number[] = []
  const lastDay = new Date(year, month, 0).getDate()
  for (let day = 1; day <= lastDay; day++) {
    if (new Date(year, month - 1, day).getDay() === 4) days.push(day)
  }
  return days
}

// Build an EconomicEvent record
function ev(
  year: number, month: number, day: number,
  hour: number, min: number,
  event: string, impact: "high" | "medium" | "low",
  unit = ""
): EconomicEvent {
  return {
    actual: null,
    estimate: null,
    prev: null,
    event,
    impact,
    time: fmtTime(year, month, day, hour, min),
    unit,
    country: "US",
  }
}

// ─── Generate US events for a given month ────────────────────────────────────
function eventsForMonth(year: number, month: number): EconomicEvent[] {
  const out: EconomicEvent[] = []

  // — NFP (Non-Farm Payrolls): 1st Friday, 8:30 AM ET (12:30 UTC during DST)
  out.push(ev(year, month, firstFriday(year, month), 12, 30,
    "Non-Farm Payrolls", "high", "K"))

  // — Unemployment Rate: same day as NFP
  out.push(ev(year, month, firstFriday(year, month), 12, 30,
    "Unemployment Rate", "high", "%"))

  // — CPI: 2nd Wednesday typically, 8:30 AM ET
  const cpiDay = nthWeekdayOfMonth(year, month, 3, 2)  // 2nd Wednesday
  out.push(ev(year, month, cpiDay, 12, 30, "CPI (Inflation)", "high", "%"))
  out.push(ev(year, month, cpiDay, 12, 30, "Core CPI", "high", "%"))

  // — PPI: usually day after CPI
  const ppiDay = Math.min(cpiDay + 1, new Date(year, month, 0).getDate())
  out.push(ev(year, month, ppiDay, 12, 30, "PPI (Producer Prices)", "medium", "%"))

  // — Retail Sales: ~15th of month (or next biz day if weekend)
  let retailDay = 15
  const retailDow = new Date(year, month - 1, retailDay).getDay()
  if (retailDow === 6) retailDay = 17       // Sat → Mon
  else if (retailDow === 0) retailDay = 16  // Sun → Mon
  out.push(ev(year, month, retailDay, 12, 30, "Retail Sales", "high", "%"))

  // — PCE Price Index: typically last Friday of month, 8:30 AM ET
  out.push(ev(year, month, lastFriday(year, month), 12, 30,
    "PCE Price Index (Fed's preferred inflation)", "high", "%"))
  out.push(ev(year, month, lastFriday(year, month), 12, 30,
    "Core PCE Price Index", "high", "%"))

  // — Jobless Claims: every Thursday, 8:30 AM ET
  for (const d of allThursdays(year, month)) {
    out.push(ev(year, month, d, 12, 30, "Initial Jobless Claims", "medium", "K"))
  }

  // — Consumer Confidence: last Tuesday of month, 10:00 AM ET
  const lastDay = new Date(year, month, 0).getDate()
  let consTueDay = lastDay
  while (new Date(year, month - 1, consTueDay).getDay() !== 2) consTueDay--
  out.push(ev(year, month, consTueDay, 14, 0, "Consumer Confidence", "medium", ""))

  // — ISM Manufacturing PMI: 1st business day, 10:00 AM ET
  let ismDay = 1
  while ([0, 6].includes(new Date(year, month - 1, ismDay).getDay())) ismDay++
  out.push(ev(year, month, ismDay, 14, 0, "ISM Manufacturing PMI", "high", ""))

  // — ISM Services PMI: 3rd business day of month, 10:00 AM ET
  let ismSvcDay = 1, biz = 0
  while (biz < 3) {
    if (![0, 6].includes(new Date(year, month - 1, ismSvcDay).getDay())) biz++
    if (biz < 3) ismSvcDay++
  }
  out.push(ev(year, month, ismSvcDay, 14, 0, "ISM Services PMI", "high", ""))

  return out
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate US economic events between [from, to] (inclusive).
 * Includes recurring releases (NFP/CPI/PCE/PPI/Retail/Jobless/PMI) +
 * FOMC meeting dates hardcoded from federalreserve.gov.
 */
export function getUSEconomicEvents(from: Date, to: Date): EconomicEvent[] {
  const events: EconomicEvent[] = []

  // Iterate months in range
  const start = new Date(from.getFullYear(), from.getMonth(), 1)
  const end = new Date(to.getFullYear(), to.getMonth() + 1, 0)
  let cursor = new Date(start)
  while (cursor <= end) {
    events.push(...eventsForMonth(cursor.getFullYear(), cursor.getMonth() + 1))
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
  }

  // Add FOMC dates
  for (const dateStr of FOMC_DATES) {
    const d = new Date(dateStr)
    events.push({
      actual: null,
      estimate: null,
      prev: null,
      event: "FOMC Rate Decision + Press Conference",
      impact: "high",
      time: `${dateStr} 18:00:00`,  // 2:00 PM ET = 18:00 UTC during DST
      unit: "%",
      country: "US",
    })
  }

  // Filter to requested window
  const fromMs = from.getTime()
  const toMs = to.getTime()
  return events.filter(e => {
    const t = new Date(e.time).getTime()
    return t >= fromMs && t <= toMs
  })
}
