/**
 * Portfolio Correlation Matrix
 * ──────────────────────────────
 * Pairwise return correlation across holdings, grouped into buckets (by sector
 * or category) so you can see whether your "diversification" is real or whether
 * a whole bucket moves together.
 *
 * Returns are daily log returns over ~6 months, aligned on common trading days.
 * Correlation is Pearson r in [-1, 1]. Fetched via the existing Yahoo candle
 * proxy (getYahooCandles), which caches internally.
 */

import { getYahooCandles } from "./yfinance"

export interface AlignedReturns {
  tickers: string[]                   // tickers that fetched successfully
  returns: Record<string, number[]>   // equal-length aligned daily log returns
  days: number                        // # of aligned return points
}

/** Fetch candles for all tickers and align daily log returns on common dates. */
export async function fetchAlignedReturns(tickers: string[]): Promise<AlignedReturns> {
  const uniq = Array.from(new Set(tickers.map(t => t.toUpperCase())))
  const closeByTicker: Record<string, Map<number, number>> = {}

  // Fetch in small batches to stay gentle on the proxy.
  const batchSize = 5
  for (let i = 0; i < uniq.length; i += batchSize) {
    const batch = uniq.slice(i, i + batchSize)
    await Promise.all(batch.map(async (t) => {
      try {
        const candle = await getYahooCandles(t, "6mo", "1d")
        if (candle && candle.c.length > 30 && candle.t.length === candle.c.length) {
          const m = new Map<number, number>()
          for (let k = 0; k < candle.t.length; k++) {
            const px = candle.c[k]
            if (px > 0) m.set(candle.t[k], px)
          }
          closeByTicker[t] = m
        }
      } catch {
        // skip failed ticker
      }
    }))
  }

  const survived = Object.keys(closeByTicker)
  if (survived.length < 2) return { tickers: survived, returns: {}, days: 0 }

  // Common timestamps present in every surviving ticker.
  let common: number[] = [...closeByTicker[survived[0]].keys()]
  for (let i = 1; i < survived.length; i++) {
    const m = closeByTicker[survived[i]]
    common = common.filter(ts => m.has(ts))
  }
  common.sort((a, b) => a - b)
  if (common.length < 20) return { tickers: survived, returns: {}, days: 0 }

  const returns: Record<string, number[]> = {}
  for (const t of survived) {
    const m = closeByTicker[t]
    const rets: number[] = []
    for (let k = 1; k < common.length; k++) {
      const prev = m.get(common[k - 1])!
      const cur = m.get(common[k])!
      rets.push(Math.log(cur / prev))
    }
    returns[t] = rets
  }

  return { tickers: survived, returns, days: common.length - 1 }
}

/** Pearson correlation coefficient of two equal-length series. */
export function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  if (n < 2) return 0
  let sa = 0, sb = 0
  for (let i = 0; i < n; i++) { sa += a[i]; sb += b[i] }
  const ma = sa / n, mb = sb / n
  let num = 0, da = 0, db = 0
  for (let i = 0; i < n; i++) {
    const xa = a[i] - ma, xb = b[i] - mb
    num += xa * xb; da += xa * xa; db += xb * xb
  }
  const den = Math.sqrt(da * db)
  return den === 0 ? 0 : num / den
}

/** Full symmetric correlation matrix for the given ticker order. */
export function correlationMatrix(tickers: string[], returns: Record<string, number[]>): number[][] {
  const n = tickers.length
  const mat: number[][] = Array.from({ length: n }, () => Array(n).fill(0))
  for (let i = 0; i < n; i++) {
    mat[i][i] = 1
    for (let j = i + 1; j < n; j++) {
      const r = pearson(returns[tickers[i]] || [], returns[tickers[j]] || [])
      mat[i][j] = r
      mat[j][i] = r
    }
  }
  return mat
}

/** Average off-diagonal correlation among a set of indices (one bucket). */
export function avgBucketCorr(indices: number[], mat: number[][]): number {
  if (indices.length < 2) return NaN
  let sum = 0, count = 0
  for (let a = 0; a < indices.length; a++) {
    for (let b = a + 1; b < indices.length; b++) {
      sum += mat[indices[a]][indices[b]]
      count++
    }
  }
  return count === 0 ? NaN : sum / count
}

/** Average of all off-diagonal correlations (whole-portfolio). */
export function avgOverallCorr(mat: number[][]): number {
  const n = mat.length
  if (n < 2) return NaN
  let sum = 0, count = 0
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) { sum += mat[i][j]; count++ }
  }
  return count === 0 ? NaN : sum / count
}

/** Heatmap color for a correlation value (red = high +corr risk, blue = hedge). */
export function corrColor(r: number): string {
  if (r >= 0.8) return "#ef4444"   // red — moves together (concentration risk)
  if (r >= 0.6) return "#f97316"   // orange
  if (r >= 0.4) return "#eab308"   // yellow
  if (r >= 0.2) return "#84cc16"   // lime
  if (r >= -0.2) return "#374151"  // gray — uncorrelated
  if (r >= -0.5) return "#3b82f6"  // blue — hedges
  return "#2563eb"                 // deep blue — strong inverse
}
