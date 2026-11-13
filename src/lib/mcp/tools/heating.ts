// src/lib/mcp/tools/heating.ts
// MCP tools for Homematic IP heating (rooms connected under Settings → Heating)
import { z } from "zod"
import type { HeatingRoom } from "@/lib/homematic/client"
import { HomematicError } from "@/lib/homematic/client"
import { getFamilyRoomSchedule, getFamilyRooms, updateFamilyRoom } from "@/lib/homematic/family"
import { type McpTool, type ToolResult, text } from "../types"

const NOT_CONNECTED = "Heating is not connected. Connect the Homematic IP Access Point in Kieke under Settings → Heating."

function describe(r: HeatingRoom): string {
  const parts = [
    `current ${r.actualTemperature ?? "?"}°C`,
    `target ${r.setPointTemperature ?? "?"}°C`,
    `mode ${r.controlMode.toLowerCase()}`,
  ]
  if (r.humidity !== null) parts.push(`humidity ${r.humidity}%`)
  if (r.boost) parts.push("boost on")
  if (r.windowOpen) parts.push("window open")
  if (r.lowBattery) parts.push("battery low")
  return `- ${r.name}: ${parts.join(", ")}`
}

function failure(err: unknown): ToolResult {
  if (err instanceof HomematicError) {
    if (err.code === "NOT_AUTHORIZED") return text("Homematic IP rejected the access token. Reconnect under Settings → Heating.", true)
    if (err.code === "THROTTLED") return text("The Homematic IP cloud is rate-limiting requests. Try again in a minute.", true)
    if (err.code === "UNREACHABLE") return text("The Homematic IP cloud is not reachable right now.", true)
  }
  throw err
}

async function listRooms(familyId: string): Promise<ToolResult> {
  try {
    const rooms = await getFamilyRooms(familyId)
    if (!rooms) return text(NOT_CONNECTED, true)
    if (rooms.length === 0) return text("No heating rooms found in Homematic IP.")
    return text(`Heating rooms:\n${rooms.map(describe).join("\n")}`)
  } catch (err) {
    return failure(err)
  }
}

function findRoom(rooms: HeatingRoom[], query: string): HeatingRoom | undefined {
  const q = query.toLowerCase()
  return (
    rooms.find((r) => r.id === query || r.name.toLowerCase() === q) ??
    (() => {
      const partial = rooms.filter((r) => r.name.toLowerCase().includes(q))
      return partial.length === 1 ? partial[0] : undefined
    })()
  )
}

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

async function getSchedule(familyId: string, args: unknown): Promise<ToolResult> {
  const parsed = z.object({ room: z.string().trim().min(1) }).safeParse(args)
  if (!parsed.success) return text(`Invalid arguments: ${parsed.error.message}`, true)
  try {
    const rooms = await getFamilyRooms(familyId)
    if (!rooms) return text(NOT_CONNECTED, true)
    const room = findRoom(rooms, parsed.data.room)
    if (!room) return text(`No unique room matches "${parsed.data.room}". Rooms: ${rooms.map((r) => r.name).join(", ")}`, true)
    let schedule
    try {
      schedule = await getFamilyRoomSchedule(familyId, room.id)
    } catch (err) {
      if (err instanceof HomematicError && err.code === "UNKNOWN") {
        return text(`Couldn't read the heating schedule for ${room.name} (${err.message}).`, true)
      }
      throw err
    }
    if (!schedule) return text(`No readable heating schedule for ${room.name}.`, true)
    const lines = schedule.days.map((d, i) => {
      const periods = d.periods.map((p) => `${p.start}–${p.end} ${p.temperature}°C`).join(", ")
      return `- ${DAY_NAMES[i]}: ${periods || "no periods"} (otherwise ${d.baseTemperature}°C)`
    })
    const profile = schedule.profileName || schedule.profileIndex
    const modeNote = room.controlMode === "AUTOMATIC" ? "" : `\nNote: the room is currently in ${room.controlMode.toLowerCase()} mode, so the schedule is not being followed.`
    return text(`Heating schedule for ${room.name} (profile ${profile}):\n${lines.join("\n")}${modeNote}`)
  } catch (err) {
    return failure(err)
  }
}

const SetArgs = z.object({
  room: z.string().trim().min(1),
  temperature: z.number().min(5).max(30).optional(),
  mode: z.enum(["automatic", "manual", "eco"]).optional(),
  boost: z.boolean().optional(),
})

async function setRoom(familyId: string, args: unknown): Promise<ToolResult> {
  const parsed = SetArgs.safeParse(args)
  if (!parsed.success) return text(`Invalid arguments: ${parsed.error.message}`, true)
  const { room: query, temperature, mode, boost } = parsed.data
  if (temperature === undefined && mode === undefined && boost === undefined) {
    return text("Nothing to change: pass temperature, mode and/or boost.", true)
  }

  try {
    const rooms = await getFamilyRooms(familyId)
    if (!rooms) return text(NOT_CONNECTED, true)
    const room = findRoom(rooms, query)
    if (!room) {
      return text(`No unique room matches "${query}". Rooms: ${rooms.map((r) => r.name).join(", ")}`, true)
    }

    const updated = await updateFamilyRoom(familyId, room.id, {
      setPointTemperature: temperature,
      controlMode: mode ? (mode.toUpperCase() as "AUTOMATIC" | "MANUAL" | "ECO") : undefined,
      boost,
    })
    const note = temperature !== undefined && updated.controlMode === "AUTOMATIC"
      ? "\nIn automatic mode the new target lasts until the next switching point of the heating schedule."
      : ""
    return text(`Updated:\n${describe(updated)}${note}`)
  } catch (err) {
    return failure(err)
  }
}

export const heatingTools: McpTool[] = [
  {
    name: "list_heating_rooms",
    description: "List the family's heating rooms (Homematic IP) with current and target temperature, mode, humidity, open windows and low batteries.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: (auth) => listRooms(auth.familyId),
  },
  {
    name: "get_heating_schedule",
    description:
      "Read the weekly heating schedule (active profile) of one room: per weekday the time periods with their target temperature and the base temperature outside them. Read-only — schedules are edited in the Homematic IP app.",
    inputSchema: {
      type: "object",
      properties: {
        room: { type: "string", description: "Room name as shown by list_heating_rooms (case-insensitive, partial match ok if unique)" },
      },
      required: ["room"],
      additionalProperties: false,
    },
    handler: (auth, args) => getSchedule(auth.familyId, args),
  },
  {
    name: "set_room_heating",
    description:
      "Change the heating in one room: target temperature (5–30 °C, 0.5° steps), mode (automatic follows the weekly schedule, manual holds the temperature, eco) and/or boost. In automatic mode a new target lasts until the next schedule switching point.",
    inputSchema: {
      type: "object",
      properties: {
        room: { type: "string", description: "Room name as shown by list_heating_rooms (case-insensitive, partial match ok if unique)" },
        temperature: { type: "number", minimum: 5, maximum: 30, description: "Target temperature in °C" },
        mode: { type: "string", enum: ["automatic", "manual", "eco"] },
        boost: { type: "boolean", description: "Turn boost on or off" },
      },
      required: ["room"],
      additionalProperties: false,
    },
    handler: (auth, args) => setRoom(auth.familyId, args),
    confirm: true,
  },
]
