// src/lib/mcp/types.ts
export type ToolResult = { content: Array<{ type: "text"; text: string }>; isError?: boolean }

export type McpAuth = { userId: string; familyId: string }

export type McpTool = {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  handler: (auth: McpAuth, args: unknown) => Promise<ToolResult>
  /**
   * The in-app assistant asks the user before running this tool (heating changes, deletions).
   * MCP clients like Claude Desktop handle confirmation themselves.
   */
  confirm?: boolean
  /** Only offered when this optional family module is switched on (Settings → Family → Features) */
  feature?: "heating"
}

export function text(t: string, isError = false): ToolResult {
  return { content: [{ type: "text", text: t }], ...(isError ? { isError } : {}) }
}
