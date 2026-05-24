/**
 * Stock Lists — รายการหุ้นแยกตามตลาด + sector
 * ─────────────────────────────────────────────
 * Source: curated from Rocket Scanner sector references (Nov 2026)
 * Categories: S&P 500, ETF, NYSE (non-S&P), Speculative/Momentum
 */

// ─── Nasdaq 100 (kept for backward compat — not exposed in UI) ───────────────
export const NASDAQ_100: string[] = [
  "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "GOOG", "META", "TSLA",
  "AVGO", "ORCL", "NFLX", "ADBE", "CSCO", "AMD", "INTC", "QCOM",
  "TXN", "INTU", "AMAT", "MU", "ASML", "ARM", "LRCX", "KLAC",
  "MRVL", "ANET", "PANW", "CRWD", "FTNT", "ADSK", "SNPS", "CDNS",
  "ADP", "PAYX", "FAST", "CTAS", "COST", "PEP", "MDLZ", "KDP",
  "MNST", "KHC", "SBUX", "MAR", "BKNG", "ABNB", "MELI", "PDD",
  "ORLY", "ROST", "LULU", "DLTR", "AMGN", "ISRG", "GILD", "VRTX",
  "REGN", "IDXX", "CMCSA", "TMUS", "WBD", "TTD", "HON", "CSX",
  "PCAR", "ODFL", "VRSK", "ROP", "AEP", "EXC", "XEL", "DLR", "EQIX",
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
  "APTV", "ARE", "ARM", "ATO", "AVB", "AVGO", "AVY", "AWK", "AXON", "AXP", "AZO",
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
  "PNW", "PODD", "POOL", "PPG", "PPL", "PRU", "PSA", "PSX", "PTC", "PWR", "PYPL",
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

export function getCombinedUniverse(): string[] {
  return Array.from(new Set([...SP500, ...NASDAQ_100])).sort()
}

// Backward compat (not exposed in UI anymore)
export const PREMIUM: string[] = SP500.slice(0, 15)

// ─── ETF universe (~35) ──────────────────────────────────────────────────────
export const ETF_LIST: string[] = [
  // Broad market
  "SPY", "QQQ", "VOO", "IVV", "VTI", "VOOG", "VUG",
  // Sector
  "XLK", "XLE", "XLF", "XLV", "XLI", "XLY", "XLP", "XLU", "XLB", "XLC", "XLRE",
  // Semiconductor / Thematic
  "SOXX", "SMH", "ARKK", "ARKW", "IBIT", "FBTC",
  // Bonds / Commodities
  "GLD", "SLV", "TLT", "USO", "UNG", "DBA",
  // International / Income
  "EEM", "VEA", "FXI", "INDA", "EWJ", "SCHD", "JEPI", "JEPQ", "QYLD", "QQQI",
  // Mag 7 ETF
  "MAGS",
]

// ─── NYSE — international ADRs + non-S&P 500 names (~40) ─────────────────────
// เน้น ADRs และหุ้นนอก S&P 500 ที่มี volume สูง · ตัดตัวเล็กเกินไป
export const NYSE_INTERESTING: string[] = [
  // China ADRs (NYSE)
  "BABA", "JD", "BIDU", "NIO", "XPEV", "LI", "BILI", "ZTO", "BEKE", "TME",
  "FUTU", "TIGR", "EDU", "TAL", "VIPS",
  // Latin America
  "ITUB", "NU", "BBD", "VALE", "PBR", "EC", "ABEV",
  // Japan/Korea
  "TM", "SONY", "HMC", "MUFG", "SMFG", "KEP",
  // Materials / Mining (Australian + others)
  "RIO", "BHP", "GOLD", "AEM", "KGC", "FNV", "WPM", "AU",
  // Other interesting NYSE
  "NOK", "BB", "FLY", "CRWV", "NBIS", "RKLB", "GLOB", "DESP", "GRAB",
]

// ─── Speculative / Momentum (NASDAQ Composite small-mid cap) ─────────────────
// ~95 ตัว · เน้นกระแส momentum + Wall Street จับตา · ไม่ใช่ pump-and-dump
export const SPECULATIVE_MOMENTUM: string[] = [
  // AI / Quantum (hottest)
  "IONQ", "RGTI", "QBTS", "QUBT", "SOUN", "BBAI", "AI", "TEM", "APP",
  // AI Software / Cybersecurity (Wall Street darling, real ARR)
  "NET", "S", "GTLB", "ESTC", "CFLT", "MNDY", "PATH", "DOCN",
  // Robotics / Autonomous / LiDAR (real product, mega-trend)
  "SYM", "MBLY", "AUR", "LAZR", "OUST",
  // Tech infra / Data center
  "NBIS", "CRWV", "IREN", "APLD", "MSTR", "VRT",
  // Defense / Space
  "RKLB", "ASTS", "ACHR", "JOBY", "LUNR", "VOYG", "KTOS", "ONDS", "RCAT",
  "AVAV", "AMPX", "BWXT", "SATS", "FLY",
  // Satellite / Earth imaging (Wall Street watching)
  "PL", "BKSY", "IRDM",
  // Nuclear / Clean Energy
  "OKLO", "NNE", "SMR", "UEC", "NXE", "UUUU",
  // EV / Auto + Charging infra
  "RIVN", "LCID", "NIO", "XPEV", "CHPT", "EVGO", "BE", "PLUG",
  // Fintech / Consumer momentum (Wall Street darling)
  "SOFI", "HOOD", "HIMS", "AFRM", "OSCR", "UPST", "TOST", "BILL",
  // Consumer / Internet momentum (big IPO + brand power)
  "RDDT", "CART", "LYFT", "CVNA", "DUOL", "CELH", "ELF", "BIRK",
  // Bio momentum + Gene editing leaders
  "VKTX", "RXRX", "AKRO", "SMMT", "CRSP", "NTLA", "EDIT", "GRAL", "TDOC",
  // Crypto miners + crypto-adjacent
  "MARA", "RIOT", "CLSK", "HUT", "BITF", "WULF", "CIFR", "GLXY",
  // Tech small-mid + materials
  "POET", "EOSE", "AEHR", "AXTI", "LWLG", "AAOI", "WOLF", "NOK", "BB",
  "ARQT", "PLAB", "QS", "SLDP", "ASTI", "DGXX", "KEEL", "LFLY",
  "SHOP", "ROKU", "DKNG", "PINS", "SNAP",
  // AI Chip Ecosystem (Wall Street tracked — Controllers/Packaging/Memory/Edge)
  "RMBS", "SIMO", "ATOM", "FORM", "CAMT", "MRAM", "GSIT", "NVEC", "NLST",
  "QUIK", "CEVA", "SYNA", "SGH", "SKYT", "POWI",
  // Semi Equipment / Advanced Packaging (small-mid)
  "ONTO", "NVTS", "ASX", "VIAV", "COHR", "SNDK",
  // Quantum-resistant crypto / Micro-cap cyber
  "LAES", "WKEY",
  // Autonomous (China) / AI Health / Optics
  "WRD", "MDAI", "LPTH",
  // Critical Minerals (rare earth + lithium)
  "LAC", "MP",
  // Bio (psychedelics) / Commercial Space
  "ATAI", "RDW",
  // Bio momentum extra — Gene editing + NASH + Cancer + Genetic testing + CNS
  "PRME", "VERV", "MDGL", "RVMD", "NTRA", "AXSM",
  // AI Hardware / Autonomous (hottest Wall Street plays)
  "CRDO", "ALAB", "HSAI", "SERV", "EH", "PONY",
  // Consumer / IPO darlings
  "TKO", "BROS", "CAVA",
  // Clean Energy storage / Carbon capture
  "NPWR", "STEM", "SES",
  // Solar / Battery storage momentum (2026 hot)
  "TE", "FLNC", "SHLS", "ARRY", "RUN",
  // Biotech leaders missing (Duchenne MD + oncology + endocrine + gene editing)
  "SRPT", "NUVL", "CRNX", "BEAM",
  // Consumer momentum
  "WING", "CHWY", "PLNT",
  // Adtech AI rotation
  "TBLA", "MGNI", "PUBM",
  // AI Insurance
  "LMND",
  // AI Infra pivot + Crypto-to-AI hosting (CoreScientific HOT)
  "CORZ", "WGS",
  // Data center power equipment (AI infrastructure boom)
  "FPS",
  // Semi mid-cap leaders + advanced materials
  "VSH", "ACLS", "ENTG", "OLED",
  // Fiber networking (AI data center fiber)
  "CLFD",
  // Health AI / Cancer diagnostics
  "EXAS", "GH", "TWST",
  // GLP-1 challenger
  "ALT",
]

// ─── Combined universe (for "all" if needed) ─────────────────────────────────
export function getAllTickers(): string[] {
  return Array.from(new Set([
    ...SP500, ...ETF_LIST, ...NYSE_INTERESTING, ...SPECULATIVE_MOMENTUM,
  ]))
}

// ═══════════════════════════════════════════════════════════════════════════
//  Sector Groups (Rocket Tool style)
//  Updated from Nov-2026 sector reference images
//  Note: a ticker may belong to multiple groups
// ═══════════════════════════════════════════════════════════════════════════

export const SECTOR_GROUPS: Record<string, { label: string; emoji: string; tickers: string[] }> = {
  mag7: {
    label: "Mag 7",
    emoji: "🚀",
    tickers: ["NVDA", "MSFT", "AAPL", "GOOGL", "GOOG", "META", "AMZN", "TSLA"],
  },
  semi: {
    label: "Semiconductor",
    emoji: "🔌",
    // จาก image semi.jpg + AI ecosystem image + เพิ่มตัวที่ขาด
    tickers: [
      "NVDA", "TSM", "AVGO", "MU", "AMD", "ASML", "INTC", "LRCX", "AMAT",
      "ARM", "QCOM", "KLAC", "SNDK", "ADI", "STX", "MRVL", "WDC", "CDNS",
      "SNPS", "MPWR", "LITE", "ON", "SMCI", "TTMI", "AMKR", "AAOI", "TRMB",
      "APLD", "QS", "WOLF", "AEHR", "POET", "SGML", "TE", "SLDP", "ASTI",
      "NXPI", "MCHP", "SWKS", "QRVO", "TER", "ENPH", "GFS",
      // AI Chip Ecosystem additions
      "RMBS", "SIMO", "ATOM", "FORM", "CAMT", "MRAM", "GSIT", "NVEC", "NLST",
      "QUIK", "CEVA", "SYNA", "SGH", "SKYT", "POWI",
      // Semi Eq / Advanced Packaging
      "ONTO", "NVTS", "ASX", "VIAV", "COHR",
      // Mid-cap leaders + advanced materials + display
      "VSH", "ACLS", "ENTG", "OLED",
    ],
  },
  datacenter: {
    label: "Data Center",
    emoji: "🏢",
    // จาก image data center.jpg (เน้น infra เท่านั้น)
    tickers: [
      "DELL", "ANET", "STX", "MRVL", "CRWV", "ALAB", "NBIS", "HPE", "PSTG",
      "SMCI", "IREN", "CLSK", "APLD", "VRT", "ETN", "GEV", "VST", "CEG",
      "DLR", "EQIX", "AMT", "CRDO", "CORZ", "CLFD", "FPS",
    ],
  },
  software: {
    label: "Software",
    emoji: "💻",
    // จาก image data center.jpg ส่วนที่เป็น software/cloud
    tickers: [
      "MSFT", "ORCL", "PLTR", "CRM", "APP", "SHOP", "NOW", "ADBE", "FTNT",
      "DDOG", "MDB", "TWLO", "VEEV", "DOCN", "TTD", "INTU", "CIEN", "SYM",
      "AXON", "EFX", "NXT", "WDAY", "TEAM", "PANW", "CRWD", "SNOW", "NET",
      "ZS", "CDNS", "SNPS", "ANSS", "PTC", "TYL", "FICO", "GDDY", "MSCI",
    ],
  },
  defense: {
    label: "Defense",
    emoji: "🛡️",
    // จาก image defense.jpg
    tickers: [
      "GE", "GEV", "RTX", "LMT", "NOC", "TDG", "LHX", "AXON", "BWXT", "KTOS",
      "AVAV", "ONDS", "AMPX", "RCAT", "GD", "HII", "LDOS", "TXT", "HWM",
    ],
  },
  space: {
    label: "Space / Aviation",
    emoji: "🚁",
    // จาก image space.jpg
    tickers: [
      "GE", "RTX", "NOC", "RKLB", "TDG", "LHX", "ASTS", "SATS", "JOBY",
      "AVAV", "FLY", "LUNR", "VOYG", "AMPX", "SES", "SPCE", "UAVS", "DFLI",
      "BA", "ACHR", "RDW", "PL", "BKSY", "IRDM", "EH",
    ],
  },
  pharma: {
    label: "Pharma / Biotech",
    emoji: "💊",
    // จาก image pharma & biotech.jpg
    tickers: [
      "LLY", "JNJ", "ABBV", "MRK", "AZN", "NVS", "NVO", "AMGN", "GILD",
      "PFE", "REGN", "BNTX", "SOLV", "SMMT", "PODD", "LNTH", "APLS", "CRSP",
      "VKTX", "PLAB", "BEAM", "SLNO", "ARQT", "TMDX", "HRMY", "AGIO",
      "INVA", "ABCL", "MNMD", "IOVA", "ZBIO", "RNA", "MRNA", "ISRG", "TMO",
      "ABT", "BMY", "VRTX", "BIIB", "IDXX", "DXCM", "RXRX",
      // Momentum additions — gene editing + NASH + cancer + genetic testing + CNS
      "PRME", "VERV", "MDGL", "RVMD", "NTRA", "AXSM",
      // Duchenne + oncology + endocrine + gene editing trio
      "SRPT", "NUVL", "CRNX", "BEAM",
      // Cancer diagnostics + DNA synthesis + GLP-1 challenger + genetic testing
      "EXAS", "GH", "TWST", "ALT", "WGS",
    ],
  },
  energy: {
    label: "Energy / Nuclear",
    emoji: "⚡",
    // จาก image Energy.jpg
    tickers: [
      "XOM", "CVX", "NEE", "CEG", "DUK", "ET", "OXY", "VST", "EQT", "NRG",
      "OKLO", "AES", "NXE", "MTDR", "UEC", "BZ", "UUUU", "SMR", "DNN",
      "SPGP", "EOSE", "SOC", "NNE", "URG", "COP", "EOG", "SLB", "MPC",
      "PSX", "BKR", "HAL", "FANG", "VLO", "WMB", "OKE", "KMI", "DVN", "TRGP",
      // Momentum additions — carbon capture + battery storage
      "NPWR", "STEM", "SES",
      // Solar + battery storage momentum
      "TE", "FLNC", "SHLS", "ARRY", "RUN",
    ],
  },
  finance: {
    label: "Banks / Finance",
    emoji: "🏦",
    // จาก image bank finance.jpg
    tickers: [
      "BRK.B", "JPM", "V", "MA", "BAC", "MS", "GS", "C", "AXP", "BLK",
      "CME", "MCO", "SYF", "IDCC", "WFC", "USB", "PNC", "TFC", "SCHW",
      "BX", "KKR", "COF", "MET", "PRU", "AFL", "ALL", "TRV", "CB", "MMC",
      "AON", "PYPL", "COIN", "SPGI", "ICE", "NDAQ", "HOOD", "AFRM", "SOFI",
    ],
  },
  dividend: {
    label: "Dividend",
    emoji: "💰",
    // จาก image dividend.jpg
    tickers: [
      "SCHD", "WM", "NKE", "AFL", "OXY", "O", "TGT", "HPE", "VICI", "KHC",
      "AGNC", "BEP", "MAIN", "ABBV", "BAC", "KO", "PG", "MS", "GE", "MRK",
      "GS", "AZN", "NVS", "C", "AXP", "PEP", "VZ", "MCD", "NEE", "AMGN",
      "BLK", "ABT", "PFE", "MO", "LMT", "LOW", "CVS", "SBUX", "DUK", "FDX",
      "T", "TMUS", "JNJ", "PLD", "AMT", "EQIX", "WELL", "SPG",
    ],
  },
  speculative: {
    label: "Speculative / Momentum",
    emoji: "🔥",
    tickers: SPECULATIVE_MOMENTUM,
  },
  crypto: {
    label: "Crypto-Related",
    emoji: "₿",
    tickers: ["COIN", "MSTR", "MARA", "RIOT", "CLSK", "HUT", "BITF", "IBIT", "FBTC",
              "WULF", "CIFR", "GLXY", "LAES", "CORZ"],
  },
  ai_ecosystem: {
    label: "AI Ecosystem",
    emoji: "🧠",
    // จาก image AI Ecosystem.jpg — Controllers/Packaging/Memory/Edge AI/AI Infra/Power/Future-Tech
    tickers: [
      // Controllers
      "RMBS", "SIMO", "ATOM",
      // Packaging / Testing
      "AMKR", "FORM", "CAMT", "ONTO",
      // Next-Gen Memory
      "MRAM", "GSIT", "NVEC", "NLST", "SNDK",
      // Edge AI
      "QUIK", "CEVA", "SYNA",
      // AI Infra
      "SGH", "SKYT", "NBIS", "CRWV", "CRDO", "ALAB",
      // Power
      "POWI", "NVTS", "VRT", "FPS",
      // Future-Tech (silicon photonics / III-V)
      "LWLG", "AXTI", "POET", "LITE", "COHR", "VIAV",
    ],
  },
  cybersecurity: {
    label: "Cybersecurity",
    emoji: "🔐",
    tickers: [
      "CRWD", "PANW", "FTNT", "ZS", "S", "NET", "OKTA", "QLYS",
      "RBRK", "TENB", "VRNS", "CYBR", "LAES", "WKEY",
    ],
  },
  critical_minerals: {
    label: "Critical Minerals",
    emoji: "⛏️",
    // Rare earth + lithium + uranium (Wall Street strategic-resource plays)
    tickers: [
      "MP", "LAC", "ALB", "SQM", "LTHM", "PLL", "SGML",
      "UEC", "UUUU", "NXE", "DNN", "URG",
    ],
  },
}

export function getSectorsForTicker(ticker: string): string[] {
  const result: string[] = []
  for (const [key, group] of Object.entries(SECTOR_GROUPS)) {
    if (group.tickers.includes(ticker.toUpperCase())) result.push(key)
  }
  return result
}
