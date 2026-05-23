/**
 * Stock Lists — S&P 500 + Nasdaq 100 constituents
 * ───────────────────────────────────────────────
 * Static lists derived from public Wikipedia sources.
 * Updated: 2024-Q4 / 2025-Q1.
 *
 * Note: index constituents change quarterly. Refresh if needed.
 */

// ─── Nasdaq 100 (top 100 non-financial on Nasdaq, by market cap) ─────────────

export const NASDAQ_100: string[] = [
  // Mag 7 + Tech leaders
  "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "GOOG", "META", "TSLA",
  // Big Tech
  "AVGO", "ORCL", "NFLX", "ADBE", "CSCO", "AMD", "INTC", "QCOM",
  "TXN", "INTU", "AMAT", "MU", "ASML", "ARM", "LRCX", "KLAC",
  "MRVL", "ANET", "PANW", "CRWD", "FTNT", "ADSK", "SNPS", "CDNS",
  "ADP", "PAYX", "FAST", "CTAS",
  // Consumer
  "COST", "PEP", "MDLZ", "KDP", "MNST", "KHC", "SBUX", "MAR",
  "BKNG", "ABNB", "MELI", "PDD", "ORLY", "ROST", "LULU", "DLTR",
  // Healthcare
  "AMGN", "ISRG", "GILD", "VRTX", "REGN", "IDXX",
  // Communications / Media
  "CMCSA", "TMUS", "WBD", "TTD",
  // Industrials
  "HON", "CSX", "PCAR", "ODFL", "VRSK", "ROP",
  // Utilities / Energy
  "AEP", "EXC", "XEL", "DLR", "EQIX",
  // Auto / Misc
  "DDOG", "ZS", "SHOP", "GFS", "MRNA", "DXCM", "BIIB", "CHTR",
  "WDAY", "TEAM", "CTSH", "CCEP", "BKR", "ROK", "ON", "CSGP",
  "WBA", "FANG", "GEHC", "MCHP", "AZN", "DASH", "TTWO", "ANSS",
  "MDB", "ARGX", "CEG", "PLTR", "APP",
]

// ─── S&P 500 — full list (alphabetical) ──────────────────────────────────────

export const SP500: string[] = [
  // A
  "A", "AAPL", "ABBV", "ABNB", "ABT", "ACGL", "ACN", "ADBE", "ADI", "ADM",
  "ADP", "ADSK", "AEE", "AEP", "AES", "AFL", "AIG", "AIZ", "AJG", "AKAM",
  "ALB", "ALGN", "ALL", "ALLE", "AMAT", "AMCR", "AMD", "AME", "AMGN", "AMP",
  "AMT", "AMZN", "ANET", "ANSS", "AON", "AOS", "APA", "APD", "APH", "APO",
  "APTV", "ARE", "ARM", "ATO", "AVB", "AVGO", "AVY", "AWK", "AXON", "AXP",
  "AZO",
  // B
  "BA", "BAC", "BALL", "BAX", "BBY", "BDX", "BEN", "BF.B", "BG", "BIIB",
  "BIO", "BK", "BKNG", "BKR", "BLDR", "BLK", "BMY", "BR", "BRK.B", "BRO",
  "BSX", "BWA", "BX", "BXP",
  // C
  "C", "CAG", "CAH", "CARR", "CAT", "CB", "CBOE", "CBRE", "CCI", "CCL",
  "CDNS", "CDW", "CE", "CEG", "CF", "CFG", "CHD", "CHRW", "CHTR", "CI",
  "CINF", "CL", "CLX", "CMCSA", "CME", "CMG", "CMI", "CMS", "CNC", "CNP",
  "COF", "COIN", "COO", "COP", "COR", "COST", "CPAY", "CPB", "CPRT", "CPT",
  "CRL", "CRM", "CRWD", "CSCO", "CSGP", "CSX", "CTAS", "CTLT", "CTRA", "CTSH",
  "CTVA", "CVS", "CVX", "CZR",
  // D
  "D", "DAL", "DAY", "DD", "DE", "DECK", "DELL", "DFS", "DG", "DGX",
  "DHI", "DHR", "DIS", "DLR", "DLTR", "DOC", "DOV", "DOW", "DPZ", "DRI",
  "DTE", "DUK", "DVA", "DVN", "DXCM",
  // E
  "EA", "EBAY", "ECL", "ED", "EFX", "EG", "EIX", "EL", "ELV", "EMN",
  "EMR", "ENPH", "EOG", "EPAM", "EQIX", "EQR", "EQT", "ERIE", "ES", "ESS",
  "ETN", "ETR", "EVRG", "EW", "EXC", "EXPD", "EXPE", "EXR",
  // F
  "F", "FANG", "FAST", "FCX", "FDS", "FDX", "FE", "FFIV", "FI", "FICO",
  "FIS", "FITB", "FMC", "FOX", "FOXA", "FRT", "FSLR", "FTNT", "FTV",
  // G
  "GD", "GDDY", "GE", "GEHC", "GEN", "GEV", "GILD", "GIS", "GL", "GLW",
  "GM", "GNRC", "GOOG", "GOOGL", "GPC", "GPN", "GRMN", "GS", "GWW",
  // H
  "HAL", "HAS", "HBAN", "HCA", "HD", "HES", "HIG", "HII", "HLT", "HOLX",
  "HON", "HPE", "HPQ", "HRL", "HSIC", "HST", "HSY", "HUBB", "HUM", "HWM",
  // I
  "IBM", "ICE", "IDXX", "IEX", "IFF", "INCY", "INTC", "INTU", "INVH",
  "IP", "IPG", "IQV", "IR", "IRM", "ISRG", "IT", "ITW", "IVZ",
  // J
  "J", "JBHT", "JBL", "JCI", "JKHY", "JNJ", "JNPR", "JPM",
  // K
  "K", "KDP", "KEY", "KEYS", "KHC", "KIM", "KKR", "KLAC", "KMB", "KMI",
  "KMX", "KO", "KR", "KVUE",
  // L
  "L", "LDOS", "LEN", "LH", "LHX", "LIN", "LKQ", "LLY", "LMT", "LNT",
  "LOW", "LRCX", "LULU", "LUV", "LVS", "LW", "LYB", "LYV",
  // M
  "MA", "MAA", "MAR", "MAS", "MCD", "MCHP", "MCK", "MCO", "MDLZ", "MDT",
  "MET", "META", "MGM", "MHK", "MKC", "MKTX", "MLM", "MMC", "MMM", "MNST",
  "MO", "MOH", "MOS", "MPC", "MPWR", "MRK", "MRNA", "MRO", "MS", "MSCI",
  "MSFT", "MSI", "MTB", "MTCH", "MTD", "MU",
  // N
  "NDAQ", "NDSN", "NEE", "NEM", "NFLX", "NI", "NKE", "NOC", "NOW", "NRG",
  "NSC", "NTAP", "NTRS", "NUE", "NVDA", "NVR", "NWS", "NWSA", "NXPI",
  // O
  "O", "ODFL", "OKE", "OMC", "ON", "ORCL", "ORLY", "OTIS", "OXY",
  // P
  "PANW", "PARA", "PAYC", "PAYX", "PCAR", "PCG", "PEG", "PEP", "PFE", "PFG",
  "PG", "PGR", "PH", "PHM", "PKG", "PLD", "PLTR", "PM", "PNC", "PNR",
  "PNW", "PODD", "POOL", "PPG", "PPL", "PRU", "PSA", "PSX", "PTC", "PWR",
  "PYPL",
  // Q
  "QCOM", "QRVO",
  // R
  "RCL", "REG", "REGN", "RF", "RJF", "RL", "RMD", "ROK", "ROL", "ROP",
  "ROST", "RSG", "RTX", "RVTY",
  // S
  "SBAC", "SBUX", "SCHW", "SHW", "SJM", "SLB", "SMCI", "SNA", "SNPS", "SO",
  "SOLV", "SPG", "SPGI", "SRE", "STE", "STLD", "STT", "STX", "STZ", "SW",
  "SWK", "SWKS", "SYF", "SYK", "SYY",
  // T
  "T", "TAP", "TDG", "TDY", "TECH", "TEL", "TER", "TFC", "TFX", "TGT",
  "TJX", "TMO", "TMUS", "TPL", "TPR", "TRGP", "TRMB", "TROW", "TRV", "TSCO",
  "TSLA", "TSN", "TT", "TTWO", "TXN", "TXT", "TYL",
  // U
  "UAL", "UBER", "UDR", "UHS", "ULTA", "UNH", "UNP", "UPS", "URI", "USB",
  // V
  "V", "VICI", "VLO", "VLTO", "VMC", "VRSK", "VRSN", "VRTX", "VST", "VTR",
  "VTRS", "VZ",
  // W
  "WAB", "WAT", "WBA", "WBD", "WDC", "WEC", "WELL", "WFC", "WM", "WMB",
  "WMT", "WRB", "WSM", "WST", "WTW", "WY", "WYNN",
  // X / Y / Z
  "XEL", "XOM", "XYL", "YUM", "ZBH", "ZBRA", "ZTS",
]

// ─── Helper: combined deduped universe ───────────────────────────────────────

export function getCombinedUniverse(): string[] {
  const set = new Set<string>([...SP500, ...NASDAQ_100])
  return Array.from(set).sort()
}

// ─── Premium subset (curated top ~15) ────────────────────────────────────────

export const PREMIUM: string[] = [
  "NVDA", "MSFT", "AAPL", "GOOGL", "META", "AMZN", "TSLA",
  "AVGO", "NFLX", "TSM", "PLTR", "COST", "LLY", "V", "MA",
]

// ─── ETF universe ────────────────────────────────────────────────────────────

export const ETF_LIST: string[] = [
  // Broad market
  "SPY", "QQQ", "VOO", "IVV", "VTI", "VOOG", "VUG",
  // Sector (XLx)
  "XLK", "XLE", "XLF", "XLV", "XLI", "XLY", "XLP", "XLU", "XLB", "XLC", "XLRE",
  // Thematic
  "ARKK", "ARKW", "SOXX", "SMH", "IBIT", "FBTC",
  // Bonds / Commodities
  "GLD", "SLV", "TLT", "USO", "UNG", "DBA",
  // International
  "EEM", "VEA", "FXI", "INDA", "EWJ",
]

// ─── Sector / Thematic Groups (Rocket Tool style) ────────────────────────────
// แต่ละ ticker อาจอยู่ในหลาย group ได้

export const SECTOR_GROUPS: Record<string, { label: string; emoji: string; tickers: string[] }> = {
  mag7: {
    label: "Mag 7",
    emoji: "🚀",
    tickers: ["NVDA", "MSFT", "AAPL", "GOOGL", "GOOG", "META", "AMZN", "TSLA"],
  },
  semis: {
    label: "Semiconductor",
    emoji: "🔌",
    tickers: [
      "NVDA", "AMD", "AVGO", "QCOM", "TXN", "AMAT", "LRCX", "KLAC", "MU",
      "INTC", "ASML", "TSM", "ARM", "ON", "MRVL", "MCHP", "QRVO", "TER",
      "NXPI", "GFS", "MPWR", "SWKS", "ADI", "ENPH",
    ],
  },
  software: {
    label: "Software",
    emoji: "💻",
    tickers: [
      "MSFT", "ORCL", "CRM", "ADBE", "NOW", "INTU", "SNPS", "CDNS", "WDAY",
      "PANW", "CRWD", "FTNT", "DDOG", "SNOW", "MDB", "NET", "PTC", "ANSS",
      "TYL", "ROP", "FICO", "GDDY", "MSCI", "CPAY", "FI", "GEN",
    ],
  },
  datacenter: {
    label: "Data Center",
    emoji: "🏢",
    tickers: [
      "DLR", "EQIX", "AMT", "VST", "CEG", "TLN", "NEE", "DUK", "GEV",
      "ETR", "AEP", "EXC", "ED", "SO", "XEL", "SRE", "D", "AES",
    ],
  },
  defense: {
    label: "Defense / Aerospace",
    emoji: "🛡️",
    tickers: [
      "LMT", "RTX", "NOC", "GD", "HII", "LDOS", "TDG", "AXON", "PLTR",
      "BA", "GE", "TXT", "HWM", "LHX",
    ],
  },
  space: {
    label: "Space / Aviation",
    emoji: "🚁",
    tickers: ["BA", "LMT", "NOC", "RTX", "GD", "TDG", "HWM", "AXON", "GEV"],
  },
  pharma: {
    label: "Pharma / Biotech",
    emoji: "💊",
    tickers: [
      "LLY", "MRK", "PFE", "ABBV", "AMGN", "BMY", "GILD", "VRTX", "REGN",
      "BIIB", "MRNA", "ISRG", "TMO", "DHR", "ABT", "JNJ", "ZTS", "IDXX",
      "INCY", "ARGX", "DXCM", "RPRX",
    ],
  },
  energy: {
    label: "Energy",
    emoji: "⚡",
    tickers: [
      "XOM", "CVX", "COP", "EOG", "OXY", "SLB", "MPC", "PSX", "BKR",
      "HAL", "FANG", "VLO", "WMB", "OKE", "KMI", "DVN", "TRGP", "HES",
      "APA", "CTRA", "MRO",
    ],
  },
  finance: {
    label: "Banks / Finance",
    emoji: "🏦",
    tickers: [
      "JPM", "BAC", "WFC", "MS", "GS", "C", "USB", "PNC", "TFC", "SCHW",
      "BLK", "AXP", "V", "MA", "BX", "KKR", "COF", "MET", "PRU", "AFL",
      "ALL", "TRV", "CB", "MMC", "AON", "PYPL", "COIN", "SPGI", "ICE",
      "NDAQ", "CME", "MCO",
    ],
  },
  dividend: {
    label: "Dividend / REIT",
    emoji: "💰",
    tickers: [
      "O", "PLD", "AMT", "EQIX", "WELL", "SPG", "VICI", "DLR", "PSA",
      "AVB", "EQR", "ARE", "INVH", "EXR", "VTR", "ESS", "MAA", "UDR",
      "JNJ", "PG", "KO", "PEP", "MO", "PM", "T", "VZ", "TMUS",
    ],
  },
  consumer: {
    label: "Consumer",
    emoji: "🛒",
    tickers: [
      "WMT", "COST", "HD", "MCD", "NKE", "SBUX", "LOW", "TGT", "BKNG",
      "MAR", "DIS", "CMCSA", "MELI", "ABNB", "LULU", "ORLY", "PG", "KO",
      "PEP", "MDLZ", "KHC", "MNST", "EL", "CL", "KMB",
    ],
  },
  crypto: {
    label: "Crypto-Related",
    emoji: "₿",
    tickers: ["COIN", "MSTR", "RIOT", "MARA", "CLSK", "HUT", "BITF"],
  },
}

// Reverse map: ticker → sectors[]
export function getSectorsForTicker(ticker: string): string[] {
  const result: string[] = []
  for (const [key, group] of Object.entries(SECTOR_GROUPS)) {
    if (group.tickers.includes(ticker.toUpperCase())) result.push(key)
  }
  return result
}
