import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const { messages, system, apiKey: clientKey } = await req.json()

  // Prefer key passed from client (from localStorage settings), fallback to env var
  const apiKey = clientKey || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || ""

  if (!apiKey || apiKey === "your_anthropic_key_here" || apiKey.length < 10) {
    return NextResponse.json(
      { content: "⚠️ Anthropic API key not configured. Please add your key in Settings." },
      { status: 200 }
    )
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 2048,
        system: system || "You are a helpful investment advisor.",
        messages,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: err }, { status: res.status })
    }

    const data = await res.json()
    const content = data.content?.[0]?.text || "No response"
    return NextResponse.json({ content })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
