"use client"

import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

interface PriceChangeProps {
  value: number
  isPercent?: boolean
  showIcon?: boolean
  className?: string
  size?: "sm" | "md" | "lg"
}

export function PriceChange({
  value,
  isPercent = false,
  showIcon = true,
  className,
  size = "md",
}: PriceChangeProps) {
  const isPositive = value > 0
  const isNegative = value < 0

  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base font-semibold",
  }

  const iconSize = size === "sm" ? "w-3 h-3" : size === "lg" ? "w-5 h-5" : "w-4 h-4"

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-medium",
        isPositive && "text-green-400",
        isNegative && "text-red-400",
        !isPositive && !isNegative && "text-gray-400",
        sizeClasses[size],
        className
      )}
    >
      {showIcon &&
        (isPositive ? (
          <TrendingUp className={iconSize} />
        ) : isNegative ? (
          <TrendingDown className={iconSize} />
        ) : (
          <Minus className={iconSize} />
        ))}
      {isPositive && "+"}
      {isPercent ? `${value.toFixed(2)}%` : `$${Math.abs(value).toFixed(2)}`}
    </span>
  )
}

interface PercentBadgeProps {
  value: number
  className?: string
}

export function PercentBadge({ value, className }: PercentBadgeProps) {
  const isPositive = value > 0
  const isNegative = value < 0
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded",
        isPositive && "bg-green-500/20 text-green-400",
        isNegative && "bg-red-500/20 text-red-400",
        !isPositive && !isNegative && "bg-gray-500/20 text-gray-400",
        className
      )}
    >
      {isPositive ? "+" : ""}
      {value.toFixed(2)}%
    </span>
  )
}
