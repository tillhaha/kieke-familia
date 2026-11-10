// src/app/api/heating/schedules/route.ts
// GET — read-only weekly schedule of each room's active heating profile:
//   { schedules: { [roomId]: WeekSchedule | null }, errors: { [roomId]: string } }  (days[0] = Monday)
// `errors` says why a room's schedule couldn't be read (HTTP status / response shape, no secrets).
// Schedules are edited in the Homematic IP app; Kieke only shows them.
import { getServerSession } from "next-auth/next"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { HomematicError } from "@/lib/homematic/client"
import { getFamilyHome, getFamilyRoomSchedule, heatingErrorResponse } from "@/lib/homematic/family"
import type { WeekSchedule } from "@/lib/homematic/client"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const familyId = session.user.familyId
  if (!familyId) return NextResponse.json({ error: "No family" }, { status: 400 })

  try {
    const home = await getFamilyHome(familyId)
    if (!home) return NextResponse.json({ error: "Heating is not connected", code: "NOT_CONNECTED" }, { status: 404 })
    const schedules: Record<string, WeekSchedule | null> = {}
    const errors: Record<string, string> = {}
    // One room at a time: the cloud rate-limits bursts
    for (const room of home.rooms) {
      try {
        schedules[room.id] = (await getFamilyRoomSchedule(familyId, room.id)) ?? null
      } catch (err) {
        console.error("[heating] schedule for room", room.id, err)
        schedules[room.id] = null
        errors[room.id] = err instanceof HomematicError ? `${err.code}: ${err.message}` : "UNKNOWN"
      }
    }
    return NextResponse.json({ schedules, errors })
  } catch (err) {
    const { status, body } = heatingErrorResponse(err)
    return NextResponse.json(body, { status })
  }
}
