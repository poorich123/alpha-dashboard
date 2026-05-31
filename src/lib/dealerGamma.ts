/**
 * Dealer Gamma Exposure (GEX) — options dealer positioning
 * ─────────────────────────────────────────────────────────
 *
 * Calculates aggregate gamma exposure that options dealers must hedge.
 * Source: SPY/QQQ/SPX options chain from Yahoo Finance (free).
 *
 * Concept:
 *   When retail buys calls/puts, dealers take the OTHER side and must
 *   delta-hedge by buying/selling the underlying. This creates predictable
 *   flow:
 *
 *     Positive GEX:
 *       Dealers are LONG gamma (net short calls + long puts)
 *       → They SELL highs, BUY lows → market mean-reverts, volatility low
 *     Negative GEX:
 *       Dealers are SHORT gamma (net long calls + short puts)
 *       → They CHASE moves → market trends, volatility high
 *     Zero Gamma Level (flip point):
 *       Critical price where regime changes — acts as magnet / pivot
 *
 * Gamma formula (Black-Scholes):
 *   gamma = N'(d1) / (S * sigma * sqrt(T))
 *   where d1 = (ln(S/K) + (r + sigma^2/2) * T) / (sigma * sqrt(T))
 *   N'(d1) = standard normal PDF = (1/sqrt(2*pi)) * exp(-d1^2/2)
 *
 * Aggregate dealer GEX (simplified retail-vs-dealer assumption):
 *   dealer GEX = sum over all strikes of (
 *      -gamma * call_OI * 100 * S^2 * 0.01  (dealers short calls, retail long)
 *      +gamma * put_OI  * 100 * S^2 * 0.01  (dealers long puts, retail short)
 *   )
 *   Multiplied by 100 shares per contract and 0.01 for 1% move sensitivity.
 *
 * Limitations:
 *   - Assumes static retail-vs-dealer split (real split varies)
 *   - Uses end-of-day OI (intraday flow not captured)
 *   - Yahoo IV may be stale / wrong on illiquid strikes — we filter outliers
 */

export interface OptionContract {
  strike: number
  lastPrice: number
  openInterest: number
  impliedVolatility: number   // decimal (0.20 = 20%)
  inTheMoney: boolean
  expiration: number          // unix sec
}

export interface OptionsChain {
  symbol: string
  spotPrice: number
  expirations: number[]
  calls: OptionContract[]
  puts:  OptionContract[]
  fetchedAt: number
}

export interface GexStrike {
  strike: number
  callGex: number      // dollar gamma per 1% move
  putGex: number
  netGex: number       // call - put
}

export interface GexSnapshot {
  symbol: string
  spotPrice: number
  asOf: number

  // Per-strike breakdown
  strikes: GexStrike[]

  // Aggregate
  totalGex: number          // sum of netGex (in $billions for SPX-class)
  callGexTotal: number
  putGexTotal: number

  // Zero-gamma level — where cumulative GEX flips sign
  zeroGammaLevel: number | null

  // Regime
  regime: "POSITIVE GEX" | "NEGATIVE GEX" | "TRANSITION"
  regimeTip: string

  // Notable strikes
  topCallWall: { strike: number; gex: number } | null    // largest call gamma (resistance)
  topPutWall:  { strike: number; gex: number } | null    // largest put gamma  (support)
}

// ── Black-Scholes gamma calculation ─────────────────────────────────────────

const SQRT_2PI = Math.sqrt(2 * Math.PI)

/** Standard normal PDF */
function phi(x: number): number {
  return Math.exp(-0.5 * x * x) / SQRT_2PI
}

/**
 * Black-Scholes gamma.
 * S = spot, K = strike, T = years to expiry, r = risk-free rate, sigma = IV
 */
export function bsGamma(S: number, K: number, T: number, sigma: number, r = 0.045): number {
  if (T <= 0 || sigma <= 0) return 0
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T))
  return phi(d1) / (S * sigma * Math.sqrt(T))
}

// ── Build GEX snapshot from options chain ───────────────────────────────────

/**
 * Compute dealer GEX from a full options chain.
 *
 * Per-strike contribution (dollar gamma per 1% spot move):
 *   gex = -gamma * OI * 100 * S^2 * 0.01
 *   (negative because dealers are short the retail-bought side)
 *
 * We compute call and put GEX separately and net them.
 * Dealers assumed: SHORT calls (retail long) + LONG puts (retail short).
 * Net dealer GEX = -callGex + putGex (approximation).
 */
export function computeGex(chain: OptionsChain): GexSnapshot {
  const S = chain.spotPrice
  const now = Date.now() / 1000
  const T_MIN = 1 / 365      // floor: 1 day
  const STRIKE_WINDOW = 0.30 // ±30% of spot — ignore deep OTM

  // Group by strike
  const strikeMap = new Map<number, GexStrike>()

  for (const c of chain.calls) {
    if (c.openInterest <= 0) continue
    if (c.impliedVolatility <= 0.01 || c.impliedVolatility > 5) continue
    if (Math.abs(c.strike - S) / S > STRIKE_WINDOW) continue
    const T = Math.max(T_MIN, (c.expiration - now) / (365.25 * 86400))
    const gamma = bsGamma(S, c.strike, T, c.impliedVolatility)
    const dollarGamma = gamma * c.openInterest * 100 * S * S * 0.01
    if (!isFinite(dollarGamma)) continue
    const entry = strikeMap.get(c.strike) || { strike: c.strike, callGex: 0, putGex: 0, netGex: 0 }
    entry.callGex += dollarGamma
    strikeMap.set(c.strike, entry)
  }

  for (const p of chain.puts) {
    if (p.openInterest <= 0) continue
    if (p.impliedVolatility <= 0.01 || p.impliedVolatility > 5) continue
    if (Math.abs(p.strike - S) / S > STRIKE_WINDOW) continue
    const T = Math.max(T_MIN, (p.expiration - now) / (365.25 * 86400))
    const gamma = bsGamma(S, p.strike, T, p.impliedVolatility)
    const dollarGamma = gamma * p.openInterest * 100 * S * S * 0.01
    if (!isFinite(dollarGamma)) continue
    const entry = strikeMap.get(p.strike) || { strike: p.strike, callGex: 0, putGex: 0, netGex: 0 }
    entry.putGex += dollarGamma
    strikeMap.set(p.strike, entry)
  }

  // Compute net (dealers short calls, long puts → net = -calls + puts)
  for (const e of strikeMap.values()) {
    e.netGex = -e.callGex + e.putGex
  }

  const strikes = Array.from(strikeMap.values()).sort((a, b) => a.strike - b.strike)

  const callGexTotal = strikes.reduce((sum, s) => sum + s.callGex, 0)
  const putGexTotal  = strikes.reduce((sum, s) => sum + s.putGex,  0)
  const totalGex     = -callGexTotal + putGexTotal

  // Find zero-gamma level — strike where cumulative netGex crosses 0
  let cumulative = 0
  let zeroGammaLevel: number | null = null
  for (let i = 0; i < strikes.length; i++) {
    const prevCum = cumulative
    cumulative += strikes[i].netGex
    if (i > 0 && Math.sign(prevCum) !== Math.sign(cumulative)) {
      // Linear interpolation between strikes[i-1] and strikes[i]
      const t = Math.abs(prevCum) / (Math.abs(prevCum) + Math.abs(cumulative))
      zeroGammaLevel = strikes[i - 1].strike + t * (strikes[i].strike - strikes[i - 1].strike)
      break
    }
  }

  // Notable strikes — largest call/put gex (walls)
  const topCallWall = strikes
    .filter(s => s.strike >= S)
    .sort((a, b) => b.callGex - a.callGex)[0]
  const topPutWall = strikes
    .filter(s => s.strike <= S)
    .sort((a, b) => b.putGex - a.putGex)[0]

  // Regime
  let regime: GexSnapshot["regime"]
  let regimeTip: string
  if (totalGex > 1e8) {
    regime = "POSITIVE GEX"
    regimeTip = "Dealers LONG gamma → they sell highs/buy lows → market mean-reverts, vol stays low. Range-trade strategy works."
  } else if (totalGex < -1e8) {
    regime = "NEGATIVE GEX"
    regimeTip = "Dealers SHORT gamma → they chase moves → trends + high vol. Momentum / breakout strategies work; avoid mean-reversion."
  } else {
    regime = "TRANSITION"
    regimeTip = "Near zero-gamma flip — high uncertainty, watch for regime shift on next big move."
  }

  return {
    symbol: chain.symbol,
    spotPrice: S,
    asOf: chain.fetchedAt,
    strikes,
    totalGex,
    callGexTotal,
    putGexTotal,
    zeroGammaLevel,
    regime,
    regimeTip,
    topCallWall: topCallWall ? { strike: topCallWall.strike, gex: topCallWall.callGex } : null,
    topPutWall:  topPutWall  ? { strike: topPutWall.strike,  gex: topPutWall.putGex  } : null,
  }
}

/** Fetch options chain via our API route (handles CORS) */
export async function fetchOptionsChain(symbol: string): Promise<OptionsChain> {
  const res = await fetch(`/api/options?symbol=${encodeURIComponent(symbol)}`)
  if (!res.ok) throw new Error(`Options fetch failed: ${res.status}`)
  return await res.json() as OptionsChain
}

/** Fetch + compute GEX in one call */
export async function fetchGex(symbol = "SPY"): Promise<GexSnapshot> {
  const chain = await fetchOptionsChain(symbol)
  return computeGex(chain)
}
