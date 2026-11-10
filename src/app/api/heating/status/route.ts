// src/app/api/heating/status/route.ts
// GET — lightweight status for the navbar icon:
//   { status: "disconnected" | "pairing" | "connected", online?: boolean | null, error?: code }
// `online` is whether the Access Point is reachable through the cloud (null = cloud call failed).
import { getServerSession } from "next-auth/next"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { getFamilyHome, getHeatingStatus, heatingErrorResponse } from "@/lib/homematic/family"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const familyId = session.user.familyId
  if (!familyId) return NextResponse.json({ status: "disconnected" })

  const status = await getHeatingStatus(familyId)
  if (status.status !== "connected") return NextResponse.json({ status: status.status })

  try {
    const home = await getFamilyHome(familyId)
    return NextResponse.json({ status: "connected", online: home?.accessPointOnline ?? false })
  } catch (err) {
    return NextResponse.json({ status: "connected", online: null, error: heatingErrorResponse(err).body.code })
  }
}
