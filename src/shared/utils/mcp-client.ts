/**
 * Model Context Protocol (MCP) Client Utilities
 * Provides typed helpers to unwrap and parse stringified MCP tool result payloads.
 */

import type { JsonRpcResponse, McpToolResult } from '../types/mcp';

/**
 * Parses double-encoded JSON tool payloads from MCP responses.
 * Follows MCP specification (@modelcontextprotocol/sdk) where tool results
 * are encapsulated in result.content[0].text.
 */
export function parseMcpToolResult<T>(response: JsonRpcResponse<McpToolResult> | McpToolResult): T | null {
  let contentText: string | undefined;

  if ('content' in response && Array.isArray(response.content)) {
    contentText = response.content[0]?.text;
  } else if ('result' in response && response.result?.content) {
    contentText = response.result.content[0]?.text;
  }

  if (!contentText) {
    return null;
  }

  try {
    return JSON.parse(contentText) as T;
  } catch {
    return contentText as unknown as T;
  }
}
