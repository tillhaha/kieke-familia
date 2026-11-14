// src/lib/homematic/family.ts
// Family-scoped Homematic IP helpers shared by the /api/heating routes and the MCP tools.
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import {
  type Connection,
  type HeatingRoom,
  type HomeState,
  type WeekSchedule,
  HomematicError,
  getHomeState,
  getSchedule,
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

// Heating switched off for the family (Settings → Family → Features) behaves like "not connected";
// the stored connection is kept, so switching it back on works right away.
export async function getHeatingStatus(familyId: string): Promise<HeatingStatus> {
  const row = await prisma.homematicConnection.findFirst({ where: { familyId, family: { heatingEnabled: true } } })
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
  const row = await prisma.homematicConnection.findFirst({ where: { familyId, family: { heatingEnabled: true } } })
  if (!row?.authToken) return null
  return { accessPointId: row.accessPointId, restUrl: row.restUrl, authToken: row.authToken }
}

// The navbar status icon, the heating page and the MCP tools all read the same
// state; a short per-family cache keeps us well clear of the cloud's rate limit.
const HOME_CACHE_MS = 15_000
const homeCache = new Map<string, { at: number; state: HomeState }>()

/** Current Access Point status + rooms, or null if heating isn't connected. */
export async function getFamilyHome(familyId: string, { fresh = false } = {}): Promise<HomeState | null> {
  const conn = await getFamilyConnection(familyId)
  if (!conn) {
    homeCache.delete(familyId)
    return null
  }
  const cached = homeCache.get(familyId)
  if (!fresh && cached && Date.now() - cached.at < HOME_CACHE_MS) return cached.state
  const state = await getHomeState(conn)
  homeCache.set(familyId, { at: Date.now(), state })
  return state
}

// Schedules only change when someone edits them in the Homematic IP app.
// Failures are cached briefly too, so a broken schedule doesn't hit the cloud on every page view.
const SCHEDULE_CACHE_MS = 10 * 60_000
const SCHEDULE_ERROR_CACHE_MS = 2 * 60_000
const scheduleCache = new Map<string, { at: number; schedule: WeekSchedule } | { at: number; error: HomematicError }>()

/**
 * The weekly schedule of a room's active profile. Returns undefined if heating isn't
 * connected or the room doesn't exist; throws a HomematicError if it can't be read.
 */
export async function getFamilyRoomSchedule(familyId: string, roomId: string): Promise<WeekSchedule | undefined> {
  const conn = await getFamilyConnection(familyId)
  const home = await getFamilyHome(familyId)
  const room = home?.rooms.find((r) => r.id === roomId)
  if (!conn || !room) return undefined
  if (!room.activeProfile) throw new HomematicError("UNKNOWN", "Room has no active heating profile")
  const key = `${familyId}:${roomId}:${room.activeProfile.index}`
  const cached = scheduleCache.get(key)
  if (cached) {
    const age = Date.now() - cached.at
    if ("schedule" in cached && age < SCHEDULE_CACHE_MS) return cached.schedule
    if ("error" in cached && age < SCHEDULE_ERROR_CACHE_MS) throw cached.error
  }
  try {
    const schedule = await getSchedule(conn, roomId, room.activeProfile)
    scheduleCache.set(key, { at: Date.now(), schedule })
    return schedule
  } catch (err) {
    const error = err instanceof HomematicError ? err : new HomematicError("UNKNOWN", err instanceof Error ? err.message : String(err))
    // Rate limiting is temporary — don't remember it
    if (error.code !== "THROTTLED") scheduleCache.set(key, { at: Date.now(), error })
    throw error
  }
}

export async function getFamilyRooms(familyId: string): Promise<HeatingRoom[] | null> {
  return (await getFamilyHome(familyId))?.rooms ?? null
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

  const home = await getFamilyHome(familyId, { fresh: true })
  const room = home?.rooms.find((r) => r.id === roomId)
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
