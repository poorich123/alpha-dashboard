import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "logo.clearbit.com" },
      { protocol: "https", hostname: "*.finnhub.io" },
      { protocol: "https", hostname: "static.finnhub.io" },
      { protocol: "https", hostname: "*.tradingview.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "enka.network" },
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
}

export default nextConfig
