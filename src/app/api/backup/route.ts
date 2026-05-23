/**
 * Server-Side Portfolio Backup
 * ─────────────────────────────
 * Writes portfolio data to a JSON file on disk (data/portfolio-backup.json).
 *
 * This protects against:
 *  - Browser clearing localStorage on close
 *  - Edge "Clear data on close" setting
 *  - InPrivate window losses
 *  - localStorage quota issues
 *
 * GET  /api/backup → returns full backup payload
 * POST /api/backup → saves payload to disk
 */

import { promises as fs } from "fs"
import path from "path"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DATA_DIR  = path.join(process.cwd(), "data")
const DATA_FILE = path.join(DATA_DIR, "portfolio-backup.json")

interface BackupPayload {
  positions?: unknown[]
  watchlist?: unknown[]
  settings?: unknown
  alerts?: unknown[]
  trades?: unknown[]
  snapshots?: unknown[]
  savedAt?: number
}

// ─── GET — fetch backup ──────────────────────────────────────────────────────

export async function GET() {
  try {
    const text = await fs.readFile(DATA_FILE, "utf-8")
    const data = JSON.parse(text) as BackupPayload
    return NextResponse.json({
      ok: true,
      data,
      savedAt: data.savedAt || 0,
    })
  } catch (err: unknown) {
    // File doesn't exist yet = no backup
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
      return NextResponse.json({ ok: true, data: null, savedAt: 0 })
    }
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 },
    )
  }
}

// ─── POST — save backup ──────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as BackupPayload
    const payload: BackupPayload = {
      ...body,
      savedAt: Date.now(),
    }

    await fs.mkdir(DATA_DIR, { recursive: true })

    // Atomic write: write to temp file then rename to avoid corruption
    const tempFile = DATA_FILE + ".tmp"
    await fs.writeFile(tempFile, JSON.stringify(payload, null, 2), "utf-8")
    await fs.rename(tempFile, DATA_FILE)

    return NextResponse.json({ ok: true, savedAt: payload.savedAt })
  } catch (err) {
    console.error("[/api/backup POST]", err)
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 },
    )
  }
}
