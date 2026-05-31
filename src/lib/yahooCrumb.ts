/**
 * Yahoo Finance crumb authentication
 * ───────────────────────────────────
 *
 * Yahoo's v7 options + v10 quoteSummary endpoints now require a "crumb"
 * token + matching cookies. Public chart endpoint (v8) still works without.
 *
 * Flow:
 *   1. GET https://fc.yahoo.com or https://finance.yahoo.com → receive cookies
 *   2. GET https://query2.finance.yahoo.com/v1/test/getcrumb with cookies
 *      → response body is the crumb (~11 chars, e.g. "xZl.Pq3.YGc")
 *   3. Use crumb as ?crumb=X query param + cookies header on subsequent calls
 *
 * The crumb is tied to the cookies — must use both together. Cookies/crumb
 * typically valid for hours. We cache for 1 hour to minimize round-trips.
 */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

let cached: { crumb: string; cookie: string; expiresAt: number } | null = null
const CACHE_MS = 60 * 60 * 1000  // 1 hour

export interface YahooAuth {
  crumb: string
  cookie: string
}

export async function getYahooAuth(): Promise<YahooAuth | null> {
  // Reuse cached auth if still valid
  if (cached && Date.now() < cached.expiresAt) {
    return { crumb: cached.crumb, cookie: cached.cookie }
  }

  try {
    // Step 1: get session cookies. fc.yahoo.com is light + sets the
    // A1/A3 cookies query2 expects. Some regions need finance.yahoo.com,
    // try fc first then fall back.
    let cookieRes = await fetch("https://fc.yahoo.com", {
      headers: { "User-Agent": UA, "Accept": "*/*" },
      redirect: "manual",
      signal: AbortSignal.timeout(6000),
    }).catch(() => null)

    let setCookie = cookieRes?.headers.get("set-cookie")
    if (!setCookie) {
      cookieRes = await fetch("https://finance.yahoo.com", {
        headers: { "User-Agent": UA, "Accept": "text/html" },
        signal: AbortSignal.timeout(6000),
      }).catch(() => null)
      setCookie = cookieRes?.headers.get("set-cookie") || ""
    }

    if (!setCookie) return null

    // Extract only the cookie name=value pairs (drop attributes like Path/Expires)
    const cookiePairs = setCookie
      .split(/,(?=\s*\w+=)/)  // split on comma followed by name=
      .map(c => c.split(";")[0].trim())
      .filter(Boolean)
      .join("; ")

    if (!cookiePairs) return null

    // Step 2: fetch crumb using the cookies
    const crumbRes = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
      headers: {
        "User-Agent": UA,
        "Cookie": cookiePairs,
        "Accept": "*/*",
      },
      signal: AbortSignal.timeout(6000),
    })

    if (!crumbRes.ok) return null
    const crumb = (await crumbRes.text()).trim()
    if (!crumb || crumb.length > 30) return null  // sanity check

    cached = { crumb, cookie: cookiePairs, expiresAt: Date.now() + CACHE_MS }
    return { crumb, cookie: cookiePairs }
  } catch {
    return null
  }
}

/** Helper: build URL with crumb query param */
export function withCrumb(url: string, crumb: string): string {
  const sep = url.includes("?") ? "&" : "?"
  return `${url}${sep}crumb=${encodeURIComponent(crumb)}`
}

/** Helper: standard auth headers for Yahoo requests */
export function yahooHeaders(auth: YahooAuth): HeadersInit {
  return {
    "User-Agent": UA,
    "Cookie": auth.cookie,
    "Accept": "application/json",
  }
}
