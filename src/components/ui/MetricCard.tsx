"use client"

import { cn } from "@/lib/utils"
import { type ReactNode } from "react"
import { PercentBadge } from "./PriceChange"

interface MetricCardProps {
  label: string
  value: string | ReactNode
  subValue?: string
  change?: number
  icon?: ReactNode
  badge?: ReactNode
  className?: string
  gradient?: boolean
  onClick?: () => void
}

export function MetricCard({
  label,
  value,
  subValue,
  change,
  icon,
  badge,
  className,
  gradient,
  onClick,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "bg-[#0C1628] border border-[#1A2E52] rounded-xl p-4 card-hover",
        gradient && "border-[#00C2D4]/30",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</div>
          <div className="text-xl font-bold text-white truncate">{value}</div>
          {subValue && <div className="text-xs text-gray-400 mt-0.5">{subValue}</div>}
          {change !== undefined && (
            <div className="mt-1">
              <PercentBadge value={change} />
            </div>
          )}
        </div>
        {(icon || badge) && (
          <div className="ml-3 flex flex-col items-end gap-1">
            {icon && <div className="text-gray-400">{icon}</div>}
            {badge}
          </div>
        )}
      </div>
    </div>
  )
}

interface SkeletonCardProps {
  className?: string
}

export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div className={cn("bg-[#0C1628] border border-[#1A2E52] rounded-xl p-4 animate-pulse", className)}>
      <div className="h-3 bg-gray-700 rounded w-24 mb-2" />
      <div className="h-7 bg-gray-700 rounded w-32 mb-1" />
      <div className="h-3 bg-gray-700 rounded w-20" />
    </div>
  )
}
