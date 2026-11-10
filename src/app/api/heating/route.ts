// src/app/api/heating/route.ts
// GET — connection status plus, when connected, all heating rooms with their current state.
import { getServerSession } from "next-auth/next"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { getRooms } from "@/lib/homematic/client"
import { getFamilyConnection, getHeatingStatus, heatingErrorResponse } from "@/lib/homematic/family"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const familyId = session.user.familyId
  if (!familyId) return NextResponse.json({ error: "No family" }, { status: 400 })

  const status = await getHeatingStatus(familyId)
  if (status.status !== "connected") return NextResponse.json(status)

  const conn = await getFamilyConnection(familyId)
  try {
    const rooms = conn ? await getRooms(conn) : []
    return NextResponse.json({ ...status, rooms })
  } catch (err) {
    const { body } = heatingErrorResponse(err)
    // Still report "connected" so the UI can show the error next to the rooms
    return NextResponse.json({ ...status, rooms: [], error: body.code })
  }
}
