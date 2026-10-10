import { describe, it, expect } from 'vitest';
import { parseMcpToolResult } from '../../../src/shared/utils/mcp-client';
import type { JsonRpcResponse, McpToolResult } from '../../../src/shared/types/mcp';

describe('MCP Client Utilities: parseMcpToolResult', () => {
  it('correctly unwraps stringified JSON payload from a JsonRpcResponse', () => {
    const rawCart = {
      sessionId: 'sess-123',
      version: 2,
      items: [{ sku: 'FRESH-SALMON-01', quantity: 2 }],
      total: 21.63,
    };

    const response: JsonRpcResponse<McpToolResult> = {
      jsonrpc: '2.0',
      id: 1,
      result: {
        content: [
          {
            type: 'text',
            text: JSON.stringify(rawCart),
          },
        ],
      },
    };

    const parsed = parseMcpToolResult<typeof rawCart>(response);
    expect(parsed).toEqual(rawCart);
    expect(parsed?.sessionId).toBe('sess-123');
    expect(parsed?.version).toBe(2);
  });

  it('correctly unwraps stringified JSON payload directly from an McpToolResult', () => {
    const rawData = { success: true, count: 5 };
    const toolResult: McpToolResult = {
      content: [{ type: 'text', text: JSON.stringify(rawData) }],
    };

    const parsed = parseMcpToolResult<typeof rawData>(toolResult);
    expect(parsed).toEqual(rawData);
  });

  it('returns plain text when payload is not JSON', () => {
    const toolResult: McpToolResult = {
      content: [{ type: 'text', text: 'Operation completed successfully' }],
    };

    const parsed = parseMcpToolResult<string>(toolResult);
    expect(parsed).toBe('Operation completed successfully');
  });

  it('returns null when content array is empty or undefined', () => {
    const emptyResult: McpToolResult = {
      content: [],
    };

    expect(parseMcpToolResult(emptyResult)).toBeNull();
  });
});
