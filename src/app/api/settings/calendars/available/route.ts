// src/app/api/settings/calendars/available/route.ts
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getGoogleCalendarClient } from "@/lib/google/calendar"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = (session.user as any).id

  try {
    const calendar = await getGoogleCalendarClient(userId)
    const res = await calendar.calendarList.list()

    // backgroundColor is undefined on some calendars (e.g. shared read-only) — coerce to null
    const calendars = (res.data.items ?? []).map((item) => ({
      id: item.id!,
      name: item.summary ?? "Unnamed calendar",
      color: item.backgroundColor ?? null,
    }))

    return NextResponse.json(calendars)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ""
    if (msg.includes("no Google account")) {
      return NextResponse.json({ error: "No Google account linked" }, { status: 400 })
    }
    const code = (error as any).code ?? (error as any).status
    if (
      code === 401 ||
      msg.includes("invalid_grant") ||
      msg.includes("No refresh token") ||
      msg.includes("insufficient")
    ) {
      return NextResponse.json(
        { error: "Google authorization expired. Please sign in again." },
        { status: 403 }
      )
    }
    console.error("Calendar list error:", error)
    return NextResponse.json({ error: "Could not reach Google Calendar" }, { status: 502 })
  }
}
