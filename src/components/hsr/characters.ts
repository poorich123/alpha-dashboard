// HSR Female Characters — enka.network CDN
// AvatarDrawCard = full gacha splash art (~2-3MB, high quality)
// AvatarRoundIcon = circular avatar icon (~26KB)

export interface HSRCharacter {
  id: number
  name: string
  path: string      // Trailblaze Path
  element: string
  color: string     // accent color
  glowColor: string
  role: string      // thematic role in the dashboard
}

export const HSR_CHARACTERS: HSRCharacter[] = [
  {
    id: 1005, name: "Kafka",    path: "Nihility",  element: "Lightning",
    color: "#9B59D4", glowColor: "rgba(155,89,212,0.4)",
    role: "Intelligence & News Monitoring"
  },
  {
    id: 1308, name: "Acheron",  path: "Nihility",  element: "Lightning",
    color: "#8B2FC9", glowColor: "rgba(139,47,201,0.4)",
    role: "Portfolio Command"
  },
  {
    id: 1303, name: "Ruan Mei", path: "Harmony",   element: "Ice",
    color: "#E078C8", glowColor: "rgba(224,120,200,0.4)",
    role: "Research & AI Analysis"
  },
  {
    id: 1306, name: "Sparkle",  path: "Harmony",   element: "Quantum",
    color: "#C84B8F", glowColor: "rgba(200,75,143,0.4)",
    role: "Strategy & Optimization"
  },
  {
    id: 1310, name: "Firefly",  path: "Destruction",element: "Fire",
    color: "#F4801A", glowColor: "rgba(244,128,26,0.4)",
    role: "Swing Trading"
  },
  {
    id: 1307, name: "Black Swan",path: "Nihility", element: "Wind",
    color: "#3DAB8E", glowColor: "rgba(61,171,142,0.4)",
    role: "Risk Analysis"
  },
  {
    id: 1309, name: "Robin",    path: "Harmony",   element: "Physical",
    color: "#C8A86B", glowColor: "rgba(200,168,107,0.4)",
    role: "Watchlist"
  },
  {
    id: 1102, name: "Seele",    path: "Hunt",      element: "Quantum",
    color: "#6B5BD6", glowColor: "rgba(107,91,214,0.4)",
    role: "Portfolio Positions"
  },
  {
    id: 1212, name: "Jingliu",  path: "Destruction",element: "Ice",
    color: "#5BA8E6", glowColor: "rgba(91,168,230,0.4)",
    role: "Stock Analyzer · Technical Analysis"
  },
]

export const CDN = "https://enka.network/ui/hsr/SpriteOutput"

export function getDrawCard(id: number) {
  return `${CDN}/AvatarDrawCard/${id}.png`
}

export function getRoundIcon(id: number) {
  return `${CDN}/AvatarRoundIcon/${id}.png`
}

// Character assigned to each page/role
export const PAGE_CHARACTERS: Record<string, HSRCharacter> = {
  dashboard:  HSR_CHARACTERS[1], // Acheron
  portfolio:  HSR_CHARACTERS[7], // Seele
  news:       HSR_CHARACTERS[0], // Kafka
  alerts:     HSR_CHARACTERS[0], // Kafka
  advisor:    HSR_CHARACTERS[2], // Ruan Mei
  strategy:   HSR_CHARACTERS[3], // Sparkle
  analytics:  HSR_CHARACTERS[5], // Black Swan
  watchlist:  HSR_CHARACTERS[6], // Robin
  swing:      HSR_CHARACTERS[4], // Firefly
  analyzer:   HSR_CHARACTERS[8], // Jingliu
}
