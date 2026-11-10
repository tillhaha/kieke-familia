// src/lib/homematic/client.ts
// Minimal client for the Homematic IP cloud (Access Point / HmIP-HAP).
//
// eQ-3 publishes no official API for the cloud. This follows the protocol used
// by the open-source `homematicip-rest-api` Python library, which Home Assistant's
// built-in integration is built on: look up the regional REST host, register a
// client by pressing the blue button on the Access Point, then call
// /hmip/<path> with the resulting auth token.
//
// Everything here runs server-side only. The auth token gives full control over
// the family's heating and must never reach the browser.
import { createHash, randomUUID } from "crypto"

const LOOKUP_URL = "https://lookup.homematic.com:48335/getHost"
const REQUEST_TIMEOUT_MS = 10_000
// Constant salt the cloud expects in the CLIENTAUTH header (from homematicip-rest-api)
const CLIENT_AUTH_SALT = "jiLpVitHvWnIGD1yo7MA"
// Shown as the client name in the Homematic IP app
const DEVICE_NAME = "Kieke"

export type HomematicErrorCode =
  | "INVALID_SGTIN"
  | "INVALID_PIN"
  | "ASSIGNMENT_LOCKED"
  | "NOT_AUTHORIZED"
  | "THROTTLED"
  | "UNREACHABLE"
  | "UNKNOWN"

export class HomematicError extends Error {
  constructor(public code: HomematicErrorCode, message?: string) {
    super(message ?? code)
  }
}

export type ControlMode = "AUTOMATIC" | "MANUAL" | "ECO"

export type HeatingRoom = {
  id: string
  name: string
  actualTemperature: number | null
  setPointTemperature: number | null
  minTemperature: number
  maxTemperature: number
  humidity: number | null
  valvePosition: number | null // 0..1
  windowOpen: boolean
  controlMode: ControlMode
  boost: boolean
  lowBattery: boolean
  thermostatCount: number
  /** The weekly heating profile the room follows in AUTOMATIC mode */
  activeProfile: { index: string; name: string } | null
}

export type SchedulePeriod = { start: string; end: string; temperature: number } // "06:00", "22:30"
export type ScheduleDay = { baseTemperature: number; periods: SchedulePeriod[] }
/** days[0] = Monday … days[6] = Sunday */
export type WeekSchedule = { profileIndex: string; profileName: string; days: ScheduleDay[] }

export type Connection = { accessPointId: string; restUrl: string; authToken: string }

/** Strip dashes/spaces from an SGTIN as printed on the Access Point; returns null if it isn't 24 hex chars. */
export function normalizeSgtin(input: string): string | null {
  const sgtin = input.replace(/[\s-]/g, "").toUpperCase()
  return /^[0-9A-F]{24}$/.test(sgtin) ? sgtin : null
}

function clientAuthToken(accessPointId: string): string {
  return createHash("sha512").update(accessPointId + CLIENT_AUTH_SALT).digest("hex").toUpperCase()
}

function clientCharacteristics(accessPointId: string) {
  // Same values as the Python library sends; the cloud is known to accept these.
  return {
    clientCharacteristics: {
      apiVersion: "10",
      applicationIdentifier: "homematicip-python",
      applicationVersion: "1.0",
      deviceManufacturer: "none",
      deviceType: "Computer",
      language: "de_DE",
      osType: "Linux",
      osVersion: "1",
    },
    id: accessPointId,
  }
}

function baseHeaders(accessPointId: string): Record<string, string> {
  return {
    "content-type": "application/json",
    accept: "application/json",
    VERSION: "12",
    CLIENTAUTH: clientAuthToken(accessPointId),
    "ACCESSPOINT-ID": accessPointId,
  }
}

async function post(url: string, body: unknown, headers: Record<string, string>): Promise<Response> {
  try {
    return await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    })
  } catch (err) {
    throw new HomematicError("UNREACHABLE", err instanceof Error ? err.message : String(err))
  }
}

async function errorFrom(res: Response): Promise<HomematicError> {
  if (res.status === 429) return new HomematicError("THROTTLED")
  if (res.status === 401 || res.status === 403) return new HomematicError("NOT_AUTHORIZED")
  const body = (await res.json().catch(() => null)) as { errorCode?: string } | null
  const code = body?.errorCode
  if (code === "INVALID_PIN") return new HomematicError("INVALID_PIN")
  if (code === "ASSIGNMENT_LOCKED") return new HomematicError("ASSIGNMENT_LOCKED")
  return new HomematicError("UNKNOWN", `Homematic IP cloud answered ${res.status}${code ? ` (${code})` : ""}`)
}

/** Ask the lookup service which regional cloud host serves this Access Point. */
export async function lookupRestUrl(accessPointId: string): Promise<string> {
  const res = await post(LOOKUP_URL, clientCharacteristics(accessPointId), {
    "content-type": "application/json",
  })
  if (!res.ok) throw await errorFrom(res)
  const data = (await res.json().catch(() => null)) as { urlREST?: string } | null
  if (!data?.urlREST) throw new HomematicError("UNKNOWN", "Lookup returned no REST host")
  return data.urlREST
}

// ---------------------------------------------------------------------------
// Pairing: startPairing → (user presses the blue button) → finishPairing
// ---------------------------------------------------------------------------

/** Register a pending client. The user then has ~5 minutes to press the blue button. */
export async function startPairing(
  accessPointId: string,
  pin?: string
): Promise<{ restUrl: string; deviceId: string }> {
  const restUrl = await lookupRestUrl(accessPointId)
  const deviceId = randomUUID()
  const headers = baseHeaders(accessPointId)
  if (pin) headers.PIN = pin
  const res = await post(
    `${restUrl}/hmip/auth/connectionRequest`,
    { deviceId, deviceName: DEVICE_NAME, sgtin: accessPointId },
    headers
  )
  if (!res.ok) throw await errorFrom(res)
  return { restUrl, deviceId }
}

/**
 * Check whether the blue button was pressed. If so, fetch and confirm the auth
 * token and return it; otherwise return null (keep waiting).
 */
export async function finishPairing(accessPointId: string, restUrl: string, deviceId: string): Promise<string | null> {
  const headers = baseHeaders(accessPointId)
  const ack = await post(`${restUrl}/hmip/auth/isRequestAcknowledged`, { deviceId, accessPointId }, headers)
  if (ack.status !== 200) {
    if (ack.status === 429) throw new HomematicError("THROTTLED")
    return null
  }

  const tokenRes = await post(`${restUrl}/hmip/auth/requestAuthToken`, { deviceId }, headers)
  if (!tokenRes.ok) throw await errorFrom(tokenRes)
  const { authToken } = (await tokenRes.json()) as { authToken?: string }
  if (!authToken) throw new HomematicError("UNKNOWN", "No auth token returned")

  const confirmRes = await post(`${restUrl}/hmip/auth/confirmAuthToken`, { deviceId, authToken }, headers)
  if (!confirmRes.ok) throw await errorFrom(confirmRes)
  return authToken
}

// ---------------------------------------------------------------------------
// Heating
// ---------------------------------------------------------------------------

async function call(conn: Connection, path: string, body: unknown): Promise<Response> {
  const res = await post(`${conn.restUrl}/hmip/${path}`, body, {
    ...baseHeaders(conn.accessPointId),
    AUTHTOKEN: conn.authToken,
  })
  if (!res.ok) throw await errorFrom(res)
  return res
}

type RawGroup = {
  id: string
  type: string
  label?: string
  actualTemperature?: number | null
  setPointTemperature?: number | null
  minTemperature?: number
  maxTemperature?: number
  humidity?: number | null
  valvePosition?: number | null
  windowState?: string | null
  controlMode?: string
  boostMode?: boolean
  lowBat?: boolean | null
  channels?: Array<{ deviceId: string }>
  activeProfile?: string
  profiles?: Record<string, { index?: string; name?: string }>
}

export type HomeState = {
  /** Whether the Access Point itself is currently connected to the cloud */
  accessPointOnline: boolean
  rooms: HeatingRoom[]
}

/** Access Point status plus all heating rooms (Homematic "HEATING" groups) with their current state. */
export async function getHomeState(conn: Connection): Promise<HomeState> {
  const res = await call(conn, "home/getCurrentState", clientCharacteristics(conn.accessPointId))
  const state = (await res.json()) as { home?: { connected?: boolean }; groups?: Record<string, RawGroup> }
  const rooms = Object.values(state.groups ?? {})
    .filter((g) => g.type === "HEATING")
    .map((g) => ({
      id: g.id,
      name: g.label ?? "",
      actualTemperature: g.actualTemperature ?? null,
      setPointTemperature: g.setPointTemperature ?? null,
      minTemperature: g.minTemperature ?? 5,
      maxTemperature: g.maxTemperature ?? 30,
      humidity: g.humidity ?? null,
      valvePosition: g.valvePosition ?? null,
      windowOpen: g.windowState === "OPEN" || g.windowState === "TILTED",
      controlMode: (["AUTOMATIC", "MANUAL", "ECO"].includes(g.controlMode ?? "") ? g.controlMode : "AUTOMATIC") as ControlMode,
      boost: !!g.boostMode,
      lowBattery: !!g.lowBat,
      thermostatCount: new Set((g.channels ?? []).map((c) => c.deviceId)).size,
      activeProfile: g.activeProfile
        ? { index: g.profiles?.[g.activeProfile]?.index ?? g.activeProfile, name: g.profiles?.[g.activeProfile]?.name ?? "" }
        : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
  return { accessPointOnline: state.home?.connected !== false, rooms }
}

export async function getRooms(conn: Connection): Promise<HeatingRoom[]> {
  return (await getHomeState(conn)).rooms
}

const WEEKDAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]

type RawPeriod = Record<string, unknown>
type RawDay = { baseValue?: unknown; periods?: unknown }

function asTime(value: unknown, minutesOfDay: unknown): string | null {
  if (typeof value === "string" && /^\d{1,2}:\d{2}/.test(value)) return value.slice(0, value.indexOf(":") + 3).padStart(5, "0")
  if (typeof minutesOfDay === "number" && minutesOfDay >= 0 && minutesOfDay <= 24 * 60) {
    return `${String(Math.floor(minutesOfDay / 60)).padStart(2, "0")}:${String(minutesOfDay % 60).padStart(2, "0")}`
  }
  return null
}

function parsePeriod(p: RawPeriod): SchedulePeriod | null {
  const start = asTime(p.starttime ?? p.startTime, p.starttimeAsMinutesOfDay ?? p.startTimeAsMinutesOfDay)
  const end = asTime(p.endtime ?? p.endTime, p.endtimeAsMinutesOfDay ?? p.endTimeAsMinutesOfDay)
  const value = p.value ?? p.temperature ?? p.setPointTemperature
  if (!start || !end || typeof value !== "number") return null
  return { start, end, temperature: value }
}

/** Short, value-free description of a JSON shape for error messages, e.g. "{homeId,profileDays{MONDAY,…}}" */
function shapeOf(v: unknown, depth = 0): string {
  if (Array.isArray(v)) return `[${v.length}]`
  if (v && typeof v === "object") {
    const keys = Object.keys(v)
    if (depth >= 1) return `{${keys.slice(0, 8).join(",")}${keys.length > 8 ? ",…" : ""}}`
    return `{${keys.slice(0, 12).map((k) => {
      const child = (v as Record<string, unknown>)[k]
      return child && typeof child === "object" ? `${k}${shapeOf(child, depth + 1)}` : k
    }).join(",")}}`
  }
  return typeof v
}

/** Parse a getProfile answer. Accepts days keyed by weekday name or 0–6 (Monday first), or as an array. */
function parseProfile(raw: unknown): ScheduleDay[] | null {
  const root = raw as { profileDays?: unknown; profile?: { profileDays?: unknown } } | null
  const pd = root?.profileDays ?? root?.profile?.profileDays
  if (!pd || typeof pd !== "object") return null
  const lookup = (i: number): RawDay | undefined => {
    if (Array.isArray(pd)) return pd[i] as RawDay | undefined
    const rec = pd as Record<string, RawDay>
    return rec[WEEKDAYS[i]] ?? rec[WEEKDAYS[i].toLowerCase()] ?? rec[String(i)]
  }
  const days: ScheduleDay[] = []
  for (let i = 0; i < 7; i++) {
    const d = lookup(i)
    if (!d || typeof d.baseValue !== "number") return null
    const periods = (Array.isArray(d.periods) ? d.periods : [])
      .map((p) => parsePeriod(p as RawPeriod))
      .filter((p): p is SchedulePeriod => p !== null)
      .sort((a, b) => a.start.localeCompare(b.start))
    days.push({ baseTemperature: d.baseValue, periods })
  }
  return days
}

/**
 * Read-only: the weekly schedule of one heating profile (as set up in the Homematic IP app).
 * Throws a HomematicError (with HTTP status / response shape in the message) if it can't be read.
 */
export async function getSchedule(
  conn: Connection,
  groupId: string,
  profile: { index: string; name: string }
): Promise<WeekSchedule> {
  // Body as sent by homematicip-rest-api; some setups reject profileName, so retry without it once
  let res: Response
  try {
    res = await call(conn, "group/heating/getProfile", { groupId, profileIndex: profile.index, profileName: profile.name })
  } catch (err) {
    if (!(err instanceof HomematicError) || err.code !== "UNKNOWN") throw err
    res = await call(conn, "group/heating/getProfile", { groupId, profileIndex: profile.index })
  }
  const raw = await res.json().catch(() => null)
  const days = parseProfile(raw)
  if (!days) throw new HomematicError("UNKNOWN", `Unexpected getProfile answer: ${shapeOf(raw)}`)
  return { profileIndex: profile.index, profileName: profile.name, days }
}

/** Set a room's target temperature. Like turning the knob: lasts until the next schedule switching point in AUTOMATIC mode. */
export async function setSetPointTemperature(conn: Connection, groupId: string, temperature: number): Promise<void> {
  await call(conn, "group/heating/setSetPointTemperature", { groupId, setPointTemperature: temperature })
}

export async function setControlMode(conn: Connection, groupId: string, controlMode: ControlMode): Promise<void> {
  await call(conn, "group/heating/setControlMode", { groupId, controlMode })
}

export async function setBoost(conn: Connection, groupId: string, boost: boolean): Promise<void> {
  await call(conn, "group/heating/setBoost", { groupId, boost })
}
