// src/lib/homematic/automation.ts
// Smart heating schedule: once a day (default 08:00) lower rooms to a base temperature
// when the person the room belongs to isn't home that day, according to the week planner
// (work location of a family member, or custody of a child).
//
// The room stays in AUTOMATIC mode — like turning the knob, the lowered target lasts
// until the room's next Homematic switching point, then the weekly plan takes over.
// Manual changes on the device or in the app after the run simply win.
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import { type HeatingRoom, HomematicError, setSetPointTemperature } from "./client"
import { getFamilyConnection, getFamilyHome } from "./family"

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export const AutomationRule = z.discriminatedUnion("type", [
  /** Lower the room when this family member works at the office (not from home) */
  z.object({ roomId: z.string().min(1), type: z.literal("WORK_AWAY"), userId: z.string().min(1) }),
  /** Lower the room when this child is not with us (custody schedule) */
  z.object({ roomId: z.string().min(1), type: z.literal("CHILD_AWAY"), personName: z.string().min(1) }),
])
export type AutomationRule = z.infer<typeof AutomationRule>

export const AutomationSettings = z.object({
  enabled: z.boolean(),
  baseTemperature: z.number().min(5).max(30),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  rules: z
    .array(AutomationRule)
    .max(50)
    .refine((rules) => new Set(rules.map((r) => r.roomId)).size === rules.length, { message: "One rule per room" }),
})
export type AutomationSettings = z.infer<typeof AutomationSettings>

export const DEFAULT_SETTINGS: AutomationSettings = { enabled: false, baseTemperature: 18, time: "08:00", rules: [] }
export const DEFAULT_TIME_ZONE = "Europe/Berlin"

/** Stored rules, ignoring anything malformed */
export function parseRules(value: unknown): AutomationRule[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((r) => {
    const parsed = AutomationRule.safeParse(r)
    return parsed.success ? [parsed.data] : []
  })
}

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

/** Local calendar date ("YYYY-MM-DD") and minutes since midnight in a time zone */
export function localClock(timeZone: string, at: Date = new Date()): { date: string; minutes: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  )
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) }
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** Week planner dates are stored as UTC midnight of the local day */
function dbDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

/** AWAY = the condition holds (lower the room), PRESENT = home / with us, UNSET = nothing entered */
export type ConditionState = "AWAY" | "PRESENT" | "UNSET"

/** What the week planner says for each rule on a given day (same order as `rules`) */
export async function conditionStates(familyId: string, rules: AutomationRule[], date: string): Promise<ConditionState[]> {
  const userIds = rules.flatMap((r) => (r.type === "WORK_AWAY" ? [r.userId] : []))
  const personNames = rules.flatMap((r) => (r.type === "CHILD_AWAY" ? [r.personName] : []))
  const day = dbDate(date)
  const [work, custody] = await Promise.all([
    userIds.length
      ? prisma.workLocation.findMany({ where: { date: day, userId: { in: userIds }, user: { familyId } } })
      : [],
    personNames.length
      ? prisma.custodySchedule.findMany({ where: { date: day, familyId, personName: { in: personNames } } })
      : [],
  ])
  return rules.map((rule) => {
    if (rule.type === "WORK_AWAY") {
      const entry = work.find((w) => w.userId === rule.userId)
      return !entry ? "UNSET" : entry.location === "HOME" ? "PRESENT" : "AWAY"
    }
    const entry = custody.find((c) => c.personName === rule.personName)
    return !entry ? "UNSET" : entry.location === "WITH_US" ? "PRESENT" : "AWAY"
  })
}

export type SkipReason =
  | "UNSET" // nothing entered in the week planner → don't act
  | "PRESENT" // working from home / child is with us
  | "ROOM_MISSING" // room no longer exists in Homematic IP
  | "NO_THERMOSTAT" // room has no thermostat connected
  | "NOT_AUTO" // someone switched the room to Manual or Eco → leave it alone
  | "BOOST" // boost is running
  | "ALREADY_LOW" // target is already at or below the base temperature

export type Decision = { action: "LOWER" } | { action: "SKIP"; reason: SkipReason }

/** Whether to lower one room. Pure, so it's easy to reason about (and to test). */
export function decide(state: ConditionState, room: HeatingRoom | undefined, baseTemperature: number): Decision {
  if (state === "UNSET") return { action: "SKIP", reason: "UNSET" }
  if (state === "PRESENT") return { action: "SKIP", reason: "PRESENT" }
  if (!room) return { action: "SKIP", reason: "ROOM_MISSING" }
  if (room.thermostatCount === 0) return { action: "SKIP", reason: "NO_THERMOSTAT" }
  if (room.controlMode !== "AUTOMATIC") return { action: "SKIP", reason: "NOT_AUTO" }
  if (room.boost) return { action: "SKIP", reason: "BOOST" }
  // With a window open the thermostat reports its window-open temperature, so don't trust it
  if (!room.windowOpen && room.setPointTemperature !== null && room.setPointTemperature <= baseTemperature) {
    return { action: "SKIP", reason: "ALREADY_LOW" }
  }
  return { action: "LOWER" }
}

// ---------------------------------------------------------------------------
// Running
// ---------------------------------------------------------------------------

export type AutomationResult = {
  roomId: string
  roomName: string
  outcome: "LOWERED" | "SKIPPED" | "FAILED"
  reason?: SkipReason
  /** Target temperature before the run */
  from?: number | null
  error?: string
}

export type AutomationRun = {
  at: string
  date: string
  trigger: "SCHEDULE" | "MANUAL"
  /** Set when the run couldn't happen at all (not connected, cloud unreachable, …) */
  error?: string
  results: AutomationResult[]
}

/**
 * Apply the rules for one family now and store the result as the last run.
 * `date` (local "YYYY-MM-DD", default today) picks which week planner day decides.
 */
export async function runAutomation(familyId: string, trigger: AutomationRun["trigger"], date?: string): Promise<AutomationRun> {
  const auto = await prisma.heatingAutomation.findUnique({ where: { familyId } })
  date ??= localClock(auto?.timeZone ?? DEFAULT_TIME_ZONE).date
  const run: AutomationRun = { at: new Date().toISOString(), date, trigger, results: [] }
  if (!auto) return { ...run, error: "Not configured" }

  const rules = parseRules(auto.rules)
  try {
    const conn = await getFamilyConnection(familyId)
    if (!conn) throw new HomematicError("NOT_AUTHORIZED", "Heating is not connected")
    const [states, home] = await Promise.all([conditionStates(familyId, rules, date), getFamilyHome(familyId, { fresh: true })])
    if (!home) throw new HomematicError("NOT_AUTHORIZED", "Heating is not connected")
    if (!home.accessPointOnline) throw new HomematicError("UNREACHABLE", "Access Point is offline")

    let changed = false
    for (const [i, rule] of rules.entries()) {
      const room = home.rooms.find((r) => r.id === rule.roomId)
      const base = { roomId: rule.roomId, roomName: room?.name ?? rule.roomId, from: room?.setPointTemperature ?? null }
      const decision = decide(states[i], room, auto.baseTemperature)
      if (decision.action === "SKIP") {
        run.results.push({ ...base, outcome: "SKIPPED", reason: decision.reason })
        continue
      }
      try {
        // Thermostats work in 0.5° steps
        await setSetPointTemperature(conn, rule.roomId, Math.round(auto.baseTemperature * 2) / 2)
        changed = true
        run.results.push({ ...base, outcome: "LOWERED" })
      } catch (err) {
        run.results.push({ ...base, outcome: "FAILED", error: err instanceof Error ? err.message : String(err) })
      }
    }
    // Refresh the cached state so the heating page shows the new targets
    if (changed) await getFamilyHome(familyId, { fresh: true }).catch(() => null)
  } catch (err) {
    run.error = err instanceof Error ? err.message : String(err)
  }

  await prisma.heatingAutomation.update({
    where: { familyId },
    data: { lastRunAt: new Date(run.at), lastRunLog: run as unknown as Prisma.InputJsonValue },
  })
  console.log(
    `[heating-automation] ${trigger} family=${familyId} date=${date}`,
    run.error ?? run.results.map((r) => `${r.roomName}:${r.outcome}${r.reason ? `(${r.reason})` : ""}`).join(" "),
  )
  return run
}

// ---------------------------------------------------------------------------
// In-app scheduler
// ---------------------------------------------------------------------------

/** A run that was missed (server down at the set time) is caught up within this window */
const CATCH_UP_MINUTES = 120
/** After a failed run (cloud unreachable, AP offline) try again after this long */
const RETRY_AFTER_MS = 10 * 60_000
const retryAfter = new Map<string, number>()

/** Run every enabled family's automation whose time has come today and hasn't run yet. */
export async function runDueAutomations(now: Date = new Date()): Promise<void> {
  const autos = await prisma.heatingAutomation.findMany({ where: { enabled: true } })
  for (const auto of autos) {
    const { date, minutes } = localClock(auto.timeZone, now)
    const start = timeToMinutes(auto.time)
    if (minutes < start || minutes >= start + CATCH_UP_MINUTES) continue
    if (auto.lastRunDate === date) continue
    if ((retryAfter.get(auto.familyId) ?? 0) > now.getTime()) continue

    // Claim the day atomically, so a second server instance (or a dev reload) can't run it twice
    const claim = await prisma.heatingAutomation.updateMany({
      where: { id: auto.id, lastRunDate: auto.lastRunDate },
      data: { lastRunDate: date },
    })
    if (claim.count === 0) continue

    const run = await runAutomation(auto.familyId, "SCHEDULE", date)
    if (run.error) {
      // Nothing happened — give the day back so the next tick can retry (within the catch-up window)
      retryAfter.set(auto.familyId, now.getTime() + RETRY_AFTER_MS)
      await prisma.heatingAutomation.updateMany({
        where: { id: auto.id, lastRunDate: date },
        data: { lastRunDate: auto.lastRunDate },
      })
    } else {
      retryAfter.delete(auto.familyId)
    }
  }
}

const TICK_MS = 60_000

/** Started once per server process from src/instrumentation.ts */
export function startHeatingScheduler(): void {
  const g = globalThis as { __heatingScheduler?: ReturnType<typeof setInterval> }
  if (g.__heatingScheduler) return
  const tick = () => {
    runDueAutomations().catch((err) => console.error("[heating-automation]", err))
  }
  g.__heatingScheduler = setInterval(tick, TICK_MS)
  g.__heatingScheduler.unref?.()
  // First check shortly after boot, so a restart around the set time catches up quickly
  setTimeout(tick, 15_000).unref?.()
  console.log("[heating-automation] scheduler started")
}
