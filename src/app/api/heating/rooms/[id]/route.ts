// src/app/api/heating/rooms/[id]/route.ts
// PATCH { setPointTemperature?, controlMode?, boost? } — change one heating room; returns its fresh state.
import { getServerSession } from "next-auth/next"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { RoomUpdate, heatingErrorResponse, updateFamilyRoom } from "@/lib/homematic/family"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const familyId = session.user.familyId
  if (!familyId) return NextResponse.json({ error: "No family" }, { status: 400 })

  const { id } = await params
  const parsed = RoomUpdate.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 })

  try {
    const room = await updateFamilyRoom(familyId, id, parsed.data)
    return NextResponse.json({ room })
  } catch (err) {
    const { status, body } = heatingErrorResponse(err)
    return NextResponse.json(body, { status })
  }
}
