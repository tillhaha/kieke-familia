// src/app/api/mcp/[token]/route.ts
// MCP endpoint with the token in the URL, for clients that can't send custom
// headers (claude.ai / Claude app custom connectors)
import { authenticateToken } from "@/lib/apiTokens"
import { handleMcpRequest, methodNotAllowed } from "@/lib/mcp/server"

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return handleMcpRequest(request, await authenticateToken(token))
}

export const GET = methodNotAllowed
export const DELETE = methodNotAllowed
