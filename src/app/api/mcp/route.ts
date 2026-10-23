// src/app/api/mcp/route.ts
// MCP endpoint authenticated with `Authorization: Bearer fam_…` (Claude Code)
import { authenticateBearer } from "@/lib/apiTokens"
import { handleMcpRequest, methodNotAllowed } from "@/lib/mcp/server"

export async function POST(request: Request) {
  return handleMcpRequest(request, await authenticateBearer(request))
}

export const GET = methodNotAllowed
export const DELETE = methodNotAllowed
