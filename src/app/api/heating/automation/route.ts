// src/app/api/heating/automation/route.ts
// GET — smart heating schedule settings + what it would do today/tomorrow + the last run.
// PUT — save the settings.
import { getServerSession } from "next-auth/next"
import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getFamilyHome, getHeatingStatus } from "@/lib/homematic/family"
import {
  AutomationSettings,
  DEFAULT_SETTINGS,
  DEFAULT_TIME_ZONE,
  addDays,
  conditionStates,
  localClock,
  parseRules,
  timeToMinutes,
} from "@/lib/homematic/automation"

async function familyFromSession() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  const familyId = session.user.familyId
  if (!familyId) return { error: NextResponse.json({ error: "No family" }, { status: 400 }) }
  return { familyId }
}

export async function GET() {
  const { familyId, error } = await familyFromSession()
  if (error) return error

  const status = await getHeatingStatus(familyId)
  if (status.status !== "connected") return NextResponse.json({ connected: false })

  const [auto, members, custodyPeople] = await Promise.all([
    prisma.heatingAutomation.findUnique({ where: { familyId } }),
    prisma.user.findMany({ where: { familyId, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.custodySchedule.findMany({ where: { familyId }, distinct: ["personName"], select: { personName: true } }),
  ])
  const home = await getFamilyHome(familyId).catch(() => null)

  const settings: AutomationSettings = auto
    ? { enabled: auto.enabled, baseTemperature: auto.baseTemperature, time: auto.time, rules: parseRules(auto.rules) }
    : DEFAULT_SETTINGS
  const { date: today } = localClock(auto?.timeZone ?? DEFAULT_TIME_ZONE)
  const tomorrow = addDays(today, 1)
  const [todayStates, tomorrowStates] = await Promise.all([
    conditionStates(familyId, settings.rules, today),
    conditionStates(familyId, settings.rules, tomorrow),
  ])

  return NextResponse.json({
    connected: true,
    settings,
    rooms: (home?.rooms ?? []).map((r) => ({ id: r.id, name: r.name, thermostatCount: r.thermostatCount })),
    roomsError: home ? null : "UNREACHABLE",
    members: members.map((m) => ({ id: m.id, name: m.name ?? "?" })),
    children: custodyPeople.map((c) => c.personName).sort(),
    preview: settings.rules.map((rule, i) => ({ roomId: rule.roomId, today: todayStates[i], tomorrow: tomorrowStates[i] })),
    today,
    tomorrow,
    lastRun: auto?.lastRunLog ?? null,
  })
}

export async function PUT(request: Request) {
  const { familyId, error } = await familyFromSession()
  if (error) return error

  const parsed = AutomationSettings.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid settings" }, { status: 400 })
  const settings = parsed.data

  // Only members of this family can be referenced
  const userIds = settings.rules.flatMap((r) => (r.type === "WORK_AWAY" ? [r.userId] : []))
  if (userIds.length) {
    const count = await prisma.user.count({ where: { id: { in: userIds }, familyId } })
    if (count !== new Set(userIds).size) return NextResponse.json({ error: "Unknown family member" }, { status: 400 })
  }

  const existing = await prisma.heatingAutomation.findUnique({ where: { familyId } })
  const { date: today, minutes } = localClock(existing?.timeZone ?? DEFAULT_TIME_ZONE)
  // If today's time has already passed, start tomorrow — saving at 08:30 shouldn't trigger
  // a catch-up run right away ("Run now" applies today's rules on demand). Moving the time
  // later today does run today, unless the scheduled run already happened.
  const lastLog = existing?.lastRunLog as { trigger?: string; date?: string } | null | undefined
  const ranToday = lastLog?.trigger === "SCHEDULE" && lastLog.date === today && existing?.lastRunDate === today
  const lastRunDate = ranToday || minutes >= timeToMinutes(settings.time) ? today : null

  const data = {
    enabled: settings.enabled,
    baseTemperature: Math.round(settings.baseTemperature * 2) / 2,
    time: settings.time,
    rules: settings.rules as unknown as Prisma.InputJsonValue,
    lastRunDate,
  }
  await prisma.heatingAutomation.upsert({ where: { familyId }, create: { familyId, ...data }, update: data })
  return NextResponse.json({ ok: true })
}
