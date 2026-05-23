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
