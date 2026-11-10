// src/app/api/heating/connect/route.ts
// Pairing with a Homematic IP Access Point:
//   POST   { sgtin, pin? } — register a pending client; the user then presses the blue button
//   GET    — check whether the button was pressed; stores the auth token once it was
//   DELETE — disconnect (forget the token)
import { getServerSession } from "next-auth/next"
import { NextResponse } from "next/server"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { HomematicError, finishPairing, normalizeSgtin, startPairing } from "@/lib/homematic/client"
import { PAIRING_WINDOW_MS, getHeatingStatus, heatingErrorResponse } from "@/lib/homematic/family"

async function requireFamily() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  const familyId = session.user.familyId
  if (!familyId) return { error: NextResponse.json({ error: "No family" }, { status: 400 }) }
  return { familyId }
}

const StartBody = z.object({ sgtin: z.string(), pin: z.string().trim().optional() })

export async function POST(request: Request) {
  const auth = await requireFamily()
  if ("error" in auth) return auth.error
  const { familyId } = auth

  const parsed = StartBody.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  const accessPointId = normalizeSgtin(parsed.data.sgtin)
  if (!accessPointId) return NextResponse.json({ error: "Invalid SGTIN", code: "INVALID_SGTIN" }, { status: 400 })

  try {
    const { restUrl, deviceId } = await startPairing(accessPointId, parsed.data.pin || undefined)
    // Starting a new pairing replaces any previous connection for this family
    const pairing = { accessPointId, restUrl, authToken: null, pairingDeviceId: deviceId, pairingStarted: new Date() }
    await prisma.homematicConnection.upsert({
      where: { familyId },
      create: { familyId, ...pairing },
      update: pairing,
    })
    return NextResponse.json(await getHeatingStatus(familyId))
  } catch (err) {
    const { status, body } = heatingErrorResponse(err)
    return NextResponse.json(body, { status })
  }
}

export async function GET() {
  const auth = await requireFamily()
  if ("error" in auth) return auth.error
  const { familyId } = auth

  const row = await prisma.homematicConnection.findUnique({ where: { familyId } })
  if (!row || row.authToken || !row.pairingDeviceId || !row.pairingStarted) {
    return NextResponse.json(await getHeatingStatus(familyId))
  }
  if (Date.now() - row.pairingStarted.getTime() >= PAIRING_WINDOW_MS) {
    return NextResponse.json({ status: "disconnected", code: "PAIRING_EXPIRED" })
  }

  try {
    const authToken = await finishPairing(row.accessPointId, row.restUrl, row.pairingDeviceId)
    if (authToken) {
      await prisma.homematicConnection.update({
        where: { familyId },
        data: { authToken, pairingDeviceId: null, pairingStarted: null },
      })
    }
    return NextResponse.json(await getHeatingStatus(familyId))
  } catch (err) {
    // A throttled check is not fatal: the client simply polls again
    if (err instanceof HomematicError && err.code === "THROTTLED") {
      return NextResponse.json(await getHeatingStatus(familyId))
    }
    const { status, body } = heatingErrorResponse(err)
    return NextResponse.json(body, { status })
  }
}

export async function DELETE() {
  const auth = await requireFamily()
  if ("error" in auth) return auth.error
  await prisma.homematicConnection.deleteMany({ where: { familyId: auth.familyId } })
  return NextResponse.json({ status: "disconnected" })
}
