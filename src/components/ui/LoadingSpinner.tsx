import { cn } from "@/lib/utils"

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center p-8", className)}>
      <div className="w-8 h-8 border-2 border-[#00C2D4] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export function InlineSpinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin inline-block",
        className
      )}
    />
  )
}
