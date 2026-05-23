"use client"

import { useState } from "react"
import { getDrawCard, getRoundIcon, type HSRCharacter } from "./characters"
import { cn } from "@/lib/utils"

interface HSRHeroBannerProps {
  character: HSRCharacter
  title: string
  subtitle?: string
  children?: React.ReactNode
  height?: string
  className?: string
}

// Path icons as SVG strings (simplified HSR path symbols)
const PATH_ICONS: Record<string, string> = {
  Nihility:    "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  Harmony:     "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 8v8M8 12h8",
  Destruction: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  Hunt:        "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  Erudition:   "M12 2a10 10 0 100 20A10 10 0 0012 2zm0 3v14M5.636 5.636l12.728 12.728M2 12h20M5.636 18.364L18.364 5.636",
  Preservation:"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  Abundance:   "M12 22V12M12 12C12 7 7 2 2 2s2 10 10 10zM12 12c0-5 5-10 10-10s-2 10-10 10z",
  Remembrance: "M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 6v4l3 3",
}

export function HSRHeroBanner({ character, title, subtitle, children, height = "h-52", className }: HSRHeroBannerProps) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)

  return (
    <div
      className={cn(
        "relative rounded-2xl overflow-hidden border border-[#1A2E52] mb-6",
        height,
        className
      )}
      style={{ background: `linear-gradient(135deg, #070B18 0%, #0C1628 60%, ${character.glowColor.replace("0.4", "0.15")} 100%)` }}
    >
      {/* Animated corner accent lines — HSR UI style */}
      <div className="absolute top-0 left-0 w-16 h-16 pointer-events-none">
        <div className="absolute top-0 left-0 w-8 h-px" style={{ background: character.color }} />
        <div className="absolute top-0 left-0 w-px h-8" style={{ background: character.color }} />
      </div>
      <div className="absolute bottom-0 right-40 w-16 h-16 pointer-events-none">
        <div className="absolute bottom-0 right-0 w-8 h-px" style={{ background: character.color, opacity: 0.5 }} />
        <div className="absolute bottom-0 right-0 w-px h-8" style={{ background: character.color, opacity: 0.5 }} />
      </div>

      {/* Background glow */}
      <div
        className="absolute right-[200px] top-0 bottom-0 w-64 rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{ background: character.glowColor }}
      />

      {/* Character art — right side, bleeds off edge slightly */}
      {!imgError && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={getDrawCard(character.id)}
          alt={character.name}
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgError(true)}
          className={cn(
            "absolute right-0 top-0 h-full object-cover object-top transition-opacity duration-700",
            imgLoaded ? "opacity-100" : "opacity-0"
          )}
          style={{ width: "auto", maxWidth: "55%", maskImage: "linear-gradient(to left, rgba(0,0,0,0.95) 30%, transparent 100%)" }}
        />
      )}

      {/* Left content gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "linear-gradient(to right, #070B18 30%, #0C1628aa 55%, transparent 75%)" }}
      />

      {/* Character name tag — bottom right corner */}
      <div className="absolute bottom-3 right-4 flex items-center gap-2 pointer-events-none">
        {!imgError && (
          <>
            {/* Round icon */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getRoundIcon(character.id)}
              alt={character.name}
              className="w-7 h-7 rounded-full border opacity-70"
              style={{ borderColor: character.color }}
            />
            <div className="text-right">
              <div className="text-xs font-bold opacity-70" style={{ color: character.color }}>{character.name}</div>
              <div className="text-[10px] text-gray-600">{character.path}</div>
            </div>
          </>
        )}
      </div>

      {/* Path badge — top right */}
      <div
        className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium opacity-60"
        style={{ borderColor: character.color + "44", color: character.color, background: character.glowColor.replace("0.4", "0.1") }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d={PATH_ICONS[character.path] || PATH_ICONS.Nihility} />
        </svg>
        {character.path}
      </div>

      {/* Main content */}
      <div className="relative z-10 h-full flex flex-col justify-center px-6 py-4 max-w-[55%]">
        {children}
      </div>
    </div>
  )
}

// Compact version for smaller sections
export function HSRCharacterStrip({ character, label }: { character: HSRCharacter; label?: string }) {
  const [imgError, setImgError] = useState(false)

  return (
    <div
      className="relative h-10 rounded-lg overflow-hidden flex items-center px-3 gap-2 border"
      style={{
        borderColor: character.color + "33",
        background: `linear-gradient(to right, ${character.glowColor.replace("0.4","0.08")}, transparent)`
      }}
    >
      {!imgError && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={getRoundIcon(character.id)}
          alt={character.name}
          className="w-6 h-6 rounded-full border flex-shrink-0"
          style={{ borderColor: character.color + "66" }}
          onError={() => setImgError(true)}
        />
      )}
      <div className="text-xs font-medium" style={{ color: character.color }}>
        {label || character.name}
      </div>
      <div className="text-[10px] text-gray-600 ml-auto">{character.path}</div>
    </div>
  )
}
