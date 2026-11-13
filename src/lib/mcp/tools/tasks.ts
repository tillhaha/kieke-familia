// src/lib/mcp/tools/tasks.ts
// Family tasks (shared with everyone in the family).
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { ISO_DATE, dateStr, dbDate, localClock } from "@/lib/localDate"
import { type McpTool, type ToolResult, text } from "../types"
import { invalidArgs } from "./family"

const include = { assignees: { select: { user: { select: { id: true, name: true } } } } } as const

function line(t: { id: string; name: string; dueDate: Date; done: boolean; description: string | null; assignees: { user: { name: string | null } }[] }) {
  const who = t.assignees.map((a) => a.user.name ?? "?").join(", ")
  return `- ${t.done ? "[done] " : ""}${t.name} (id: ${t.id}; due ${dateStr(t.dueDate)}${who ? `; for ${who}` : ""})${t.description ? ` — ${t.description}` : ""}`
}

async function validAssignees(familyId: string, ids: string[] | undefined): Promise<string | null> {
  if (!ids?.length) return null
  const count = await prisma.user.count({ where: { id: { in: ids }, familyId } })
  return count === new Set(ids).size ? null : "Unknown assignee id (use list_family_members)."
}

async function listTasks(familyId: string, args: unknown): Promise<ToolResult> {
  const parsed = z.object({ includeDone: z.boolean().optional() }).safeParse(args ?? {})
  if (!parsed.success) return invalidArgs(parsed.error)
  const tasks = await prisma.task.findMany({
    where: { familyId, ...(parsed.data.includeDone ? {} : { done: false }) },
    orderBy: { dueDate: "asc" },
    include,
  })
  if (!tasks.length) return text("No tasks.")
  return text(`Today is ${localClock().date}.\n${tasks.map(line).join("\n")}`)
}

const CreateTask = z.object({
  name: z.string().trim().min(1).max(200),
  dueDate: z.string().regex(ISO_DATE),
  description: z.string().max(2000).optional(),
  assigneeIds: z.array(z.string().min(1)).max(10).optional(),
})

async function createTask(familyId: string, args: unknown): Promise<ToolResult> {
  const parsed = CreateTask.safeParse(args)
  if (!parsed.success) return invalidArgs(parsed.error)
  const { name, dueDate, description, assigneeIds } = parsed.data
  const err = await validAssignees(familyId, assigneeIds)
  if (err) return text(err, true)
  const task = await prisma.task.create({
    data: {
      familyId,
      name,
      dueDate: dbDate(dueDate),
      description: description?.trim() || null,
      assignees: { create: [...new Set(assigneeIds ?? [])].map((userId) => ({ userId })) },
    },
    include,
  })
  return text(`Created task:\n${line(task)}`)
}

const UpdateTask = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(200).optional(),
  dueDate: z.string().regex(ISO_DATE).optional(),
  description: z.string().max(2000).nullable().optional(),
  assigneeIds: z.array(z.string().min(1)).max(10).optional(),
  done: z.boolean().optional(),
})

async function updateTask(familyId: string, args: unknown): Promise<ToolResult> {
  const parsed = UpdateTask.safeParse(args)
  if (!parsed.success) return invalidArgs(parsed.error)
  const { id, name, dueDate, description, assigneeIds, done } = parsed.data
  const existing = await prisma.task.findFirst({ where: { id, familyId }, select: { id: true } })
  if (!existing) return text("Task not found.", true)
  const err = await validAssignees(familyId, assigneeIds)
  if (err) return text(err, true)

  const task = await prisma.$transaction(async (tx) => {
    if (assigneeIds) {
      await tx.taskAssignee.deleteMany({ where: { taskId: id } })
      await tx.taskAssignee.createMany({ data: [...new Set(assigneeIds)].map((userId) => ({ taskId: id, userId })) })
    }
    return tx.task.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(dueDate !== undefined ? { dueDate: dbDate(dueDate) } : {}),
        ...(description !== undefined ? { description: description?.trim() || null } : {}),
        ...(done !== undefined ? { done } : {}),
      },
      include,
    })
  })
  return text(`Updated task:\n${line(task)}`)
}

async function deleteTask(familyId: string, args: unknown): Promise<ToolResult> {
  const parsed = z.object({ id: z.string().min(1) }).safeParse(args)
  if (!parsed.success) return invalidArgs(parsed.error)
  const task = await prisma.task.findFirst({ where: { id: parsed.data.id, familyId }, select: { id: true, name: true } })
  if (!task) return text("Task not found.", true)
  await prisma.task.delete({ where: { id: task.id } })
  return text(`Deleted task "${task.name}".`)
}

export const taskTools: McpTool[] = [
  {
    name: "list_tasks",
    description: "List the family's tasks (open ones by default) with due dates, assignees and ids.",
    inputSchema: { type: "object", properties: { includeDone: { type: "boolean" } } },
    handler: (auth, args) => listTasks(auth.familyId, args),
  },
  {
    name: "create_task",
    description: "Create a family task (visible to the whole family) with a due date and optional assignees (member ids from list_family_members). For the user's own private todos use capture_thoughts instead.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        dueDate: { type: "string", description: "YYYY-MM-DD" },
        description: { type: "string" },
        assigneeIds: { type: "array", items: { type: "string" } },
      },
      required: ["name", "dueDate"],
    },
    handler: (auth, args) => createTask(auth.familyId, args),
  },
  {
    name: "update_task",
    description: "Change a family task: name, due date, description, assignees (replaces them) or mark it done / not done.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        dueDate: { type: "string", description: "YYYY-MM-DD" },
        description: { type: "string", description: "\"\" clears it" },
        assigneeIds: { type: "array", items: { type: "string" } },
        done: { type: "boolean" },
      },
      required: ["id"],
    },
    handler: (auth, args) => updateTask(auth.familyId, args),
  },
  {
    name: "delete_task",
    description: "Delete a family task for good. (To finish a task, use update_task with done: true instead.)",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    handler: (auth, args) => deleteTask(auth.familyId, args),
    confirm: true,
  },
]
