// src/lib/homematic/family.ts
// Family-scoped Homematic IP helpers shared by the /api/heating routes and the MCP tools.
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import {
  type Connection,
  type HeatingRoom,
  HomematicError,
  getRooms,
  setBoost,
  setControlMode,
  setSetPointTemperature,
} from "./client"

// The Access Point drops a pending connection request after about 5 minutes
export const PAIRING_WINDOW_MS = 5 * 60 * 1000

export type HeatingStatus =
  | { status: "disconnected" }
  | { status: "pairing"; accessPointId: string; expiresAt: string }
  | { status: "connected"; accessPointId: string }

export async function getHeatingStatus(familyId: string): Promise<HeatingStatus> {
  const row = await prisma.homematicConnection.findUnique({ where: { familyId } })
  if (!row) return { status: "disconnected" }
  if (row.authToken) return { status: "connected", accessPointId: row.accessPointId }
  if (row.pairingDeviceId && row.pairingStarted && Date.now() - row.pairingStarted.getTime() < PAIRING_WINDOW_MS) {
    return {
      status: "pairing",
      accessPointId: row.accessPointId,
      expiresAt: new Date(row.pairingStarted.getTime() + PAIRING_WINDOW_MS).toISOString(),
    }
  }
  return { status: "disconnected" }
}

export async function getFamilyConnection(familyId: string): Promise<Connection | null> {
  const row = await prisma.homematicConnection.findUnique({ where: { familyId } })
  if (!row?.authToken) return null
  return { accessPointId: row.accessPointId, restUrl: row.restUrl, authToken: row.authToken }
}

export async function getFamilyRooms(familyId: string): Promise<HeatingRoom[] | null> {
  const conn = await getFamilyConnection(familyId)
  return conn ? getRooms(conn) : null
}

export const RoomUpdate = z
  .object({
    setPointTemperature: z.number().min(5).max(30).optional(),
    controlMode: z.enum(["AUTOMATIC", "MANUAL", "ECO"]).optional(),
    boost: z.boolean().optional(),
  })
  .refine((v) => v.setPointTemperature !== undefined || v.controlMode !== undefined || v.boost !== undefined, {
    message: "Nothing to change",
  })
export type RoomUpdate = z.infer<typeof RoomUpdate>

/** Apply changes to one heating room, then return its fresh state. */
export async function updateFamilyRoom(familyId: string, roomId: string, update: RoomUpdate): Promise<HeatingRoom> {
  const conn = await getFamilyConnection(familyId)
  if (!conn) throw new HomematicError("NOT_AUTHORIZED", "Heating is not connected")

  // Order matters: switching mode first, so a manual temperature isn't immediately overridden
  if (update.controlMode !== undefined) await setControlMode(conn, roomId, update.controlMode)
  if (update.setPointTemperature !== undefined) {
    // Thermostats work in 0.5° steps
    await setSetPointTemperature(conn, roomId, Math.round(update.setPointTemperature * 2) / 2)
  }
  if (update.boost !== undefined) await setBoost(conn, roomId, update.boost)

  const room = (await getRooms(conn)).find((r) => r.id === roomId)
  if (!room) throw new HomematicError("UNKNOWN", "Room not found")
  return room
}

/** Map a HomematicError to an HTTP status + stable error code for the client. */
export function heatingErrorResponse(err: unknown): { status: number; body: { error: string; code: string } } {
  if (err instanceof HomematicError) {
    const status =
      err.code === "NOT_AUTHORIZED" ? 403
      : err.code === "INVALID_PIN" || err.code === "INVALID_SGTIN" ? 400
      : err.code === "ASSIGNMENT_LOCKED" ? 409
      : err.code === "THROTTLED" ? 429
      : 502
    return { status, body: { error: err.message, code: err.code } }
  }
  console.error("[heating]", err)
  return { status: 500, body: { error: "Something went wrong", code: "UNKNOWN" } }
}
