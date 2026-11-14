// src/lib/mcp/tools/index.ts
// All Familia tools — served by the MCP server and used by the in-app assistant.
import type { McpTool } from "../types"
import { getFamilyFeatures } from "@/lib/familyFeatures"
import { shoppingTools } from "./shopping"
import { personalTodoTools } from "./personalTodos"
import { heatingTools } from "./heating"
import { familyTools } from "./family"
import { taskTools } from "./tasks"
import { calendarTools } from "./calendar"

export const TOOLS: McpTool[] = [
  ...familyTools,
  ...calendarTools,
  ...taskTools,
  ...shoppingTools,
  ...personalTodoTools,
  ...heatingTools.map((t) => ({ ...t, feature: "heating" as const })),
]

/** The tools this family can use — module tools only when the module is switched on */
export async function toolsForFamily(familyId: string): Promise<McpTool[]> {
  const features = await getFamilyFeatures(familyId)
  return TOOLS.filter((t) => !t.feature || features[t.feature])
}
