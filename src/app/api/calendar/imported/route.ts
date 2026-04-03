// src/app/api/calendar/imported/route.ts
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
function normalizeIcalUrl(url: string): string {
  return url.replace(/^webcal:\/\//i, "https://")
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = (session.user as any).id

  const calendars = await prisma.importedCalendar.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, url: true, name: true, color: true, createdAt: true },
  })
  return NextResponse.json(calendars)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = (session.user as any).id

  let body: { url?: string; name?: string; color?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { url, name, color } = body
  if (!url || !name?.trim()) {
    return NextResponse.json({ error: "url and name are required" }, { status: 400 })
  }

  const normalized = normalizeIcalUrl(url.trim())
  if (!/^https?:\/\//i.test(normalized)) {
    return NextResponse.json(
      { error: "URL must start with https://, http://, or webcal://" },
      { status: 422 }
    )
  }

  // Test-fetch to validate it's a real iCal feed
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(normalized, {
      signal: controller.signal,
      headers: { "User-Agent": "Familia-Calendar/1.0" },
    })
    clearTimeout(timer)

    console.log(`[imported] fetch ${normalized} → status=${res.status} content-type=${res.headers.get("content-type")} final-url=${res.url}`)

    if (!res.ok) {
      return NextResponse.json(
        { error: `Could not fetch URL (HTTP ${res.status})` },
        { status: 422 }
      )
    }

    const text = await res.text()
    const first = text.trimStart().slice(0, 200)
    const ct = res.headers.get("content-type") ?? ""
    console.log(`[imported] first 200 chars: ${first}`)

    if (!first.includes("BEGIN:VCALENDAR") && !ct.includes("text/calendar") && !ct.includes("application/octet-stream")) {
      return NextResponse.json(
        { error: `URL does not appear to be a valid iCal feed (content-type: ${ct || "none"})` },
        { status: 422 }
      )
    }
  } catch (err: unknown) {
    const isAbort = err instanceof Error && err.name === "AbortError"
    console.error(`[imported] fetch error:`, err)
    return NextResponse.json(
      { error: isAbort ? "Request timed out — check the URL and try again" : `Failed to fetch URL: ${err instanceof Error ? err.message : err}` },
      { status: 422 }
    )
  }

  try {
    const calendar = await prisma.importedCalendar.create({
      data: {
        userId,
        url: normalized,
        name: name.trim(),
        color: color ?? "#d8ead8",
      },
      select: { id: true, url: true, name: true, color: true, createdAt: true },
    })
    return NextResponse.json(calendar, { status: 201 })
  } catch (err) {
    console.error("[imported calendar] create error:", err)
    return NextResponse.json({ error: "Failed to save calendar" }, { status: 500 })
  }
}
