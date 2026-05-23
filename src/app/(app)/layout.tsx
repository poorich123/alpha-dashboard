"use client"

import { Sidebar, MobileNav } from "@/components/layout/Sidebar"
import { AlertPanel } from "@/components/alerts/AlertPanel"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#070B18]">
      <Sidebar />
      <main className="flex-1 lg:ml-56 pb-16 lg:pb-0 min-h-screen">
        {children}
      </main>
      <MobileNav />
      <AlertPanel />
    </div>
  )
}
