// src/lib/mcp/tools/index.ts
// All Familia tools — served by the MCP server and used by the in-app assistant.
import type { McpTool } from "../types"
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
  ...heatingTools,
]
