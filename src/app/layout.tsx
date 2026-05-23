import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

export const metadata: Metadata = {
  title: "Alpha Dashboard - Personal Hedge Fund",
  description: "Professional investment tracking and AI-powered portfolio management",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} dark`} suppressHydrationWarning>
      <body className="min-h-screen bg-[#070B18] text-gray-100 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
