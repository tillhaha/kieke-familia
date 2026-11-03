// src/lib/mcp/types.ts
export type ToolResult = { content: Array<{ type: "text"; text: string }>; isError?: boolean }

export type McpAuth = { userId: string; familyId: string }

export type McpTool = {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  handler: (auth: McpAuth, args: unknown) => Promise<ToolResult>
}

export function text(t: string, isError = false): ToolResult {
  return { content: [{ type: "text", text: t }], ...(isError ? { isError } : {}) }
}
