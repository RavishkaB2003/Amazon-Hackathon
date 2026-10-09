import { describe, it, expect, beforeEach } from 'vitest';
import { dispatchJsonRpc } from '../../../src/server/mcp/router';
import {
  registerTool,
  clearTools,
  toolRegistry,
} from '../../../src/server/mcp/registry';
import { JSONRPC_ERRORS } from '../../../src/shared/types/mcp';

describe('JSON-RPC 2.0 Protocol Engine (Unit)', () => {
  beforeEach(() => {
    clearTools();
  });

  it('handles "initialize" method with standard capabilities and serverInfo', async () => {
    const request = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: {
          name: 'aura-simulator',
          version: '1.0.0',
        },
      },
    };

    const response = await dispatchJsonRpc(request);
    expect(response).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: {
        protocolVersion: '2025-11-25',
        capabilities: {
          tools: {
            listChanged: true,
          },
        },
        serverInfo: {
          name: 'aura-mcp-server',
          version: '1.0.0',
        },
      },
    });
  });

  it('handles "initialize" gracefully when clientInfo is omitted', async () => {
    const request = {
      jsonrpc: '2.0',
      id: 'init-2',
      method: 'initialize',
    };

    const response = await dispatchJsonRpc(request);
    expect(response).toMatchObject({
      jsonrpc: '2.0',
      id: 'init-2',
      result: {
        protocolVersion: '2025-11-25',
        serverInfo: {
          name: 'aura-mcp-server',
        },
      },
    });
  });

  it('handles "ping" liveness check returning empty object result', async () => {
    const request = {
      jsonrpc: '2.0',
      id: 42,
      method: 'ping',
    };

    const response = await dispatchJsonRpc(request);
    expect(response).toEqual({
      jsonrpc: '2.0',
      id: 42,
      result: {},
    });
  });

  it('handles "tools/list" returning all registered tools', async () => {
    registerTool({
      name: 'test_calculator',
      description: 'Performs basic addition',
      inputSchema: {
        type: 'object',
        properties: {
          a: { type: 'number' },
          b: { type: 'number' },
        },
        required: ['a', 'b'],
      },
      handler: async (args) => ({
        content: [{ type: 'text', text: String(Number(args.a) + Number(args.b)) }],
      }),
    });

    const request = {
      jsonrpc: '2.0',
      id: 100,
      method: 'tools/list',
    };

    const response = await dispatchJsonRpc(request);
    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe(100);
    if ('result' in response) {
      const tools = (response.result as { tools: unknown[] }).tools;
      expect(tools).toHaveLength(1);
      expect(tools[0]).toMatchObject({
        name: 'test_calculator',
        description: 'Performs basic addition',
      });
    } else {
      throw new Error('Expected result in response');
    }
  });

  it('handles "tools/call" executing tool handler successfully', async () => {
    registerTool({
      name: 'echo_tool',
      description: 'Echoes message',
      inputSchema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
        },
        required: ['message'],
      },
      handler: async (args) => ({
        content: [{ type: 'text', text: `Echo: ${args.message}` }],
      }),
    });

    const request = {
      jsonrpc: '2.0',
      id: 'call-1',
      method: 'tools/call',
      params: {
        name: 'echo_tool',
        arguments: { message: 'hello aura' },
      },
    };

    const response = await dispatchJsonRpc(request);
    expect(response).toEqual({
      jsonrpc: '2.0',
      id: 'call-1',
      result: {
        content: [{ type: 'text', text: 'Echo: hello aura' }],
      },
    });
  });

  it('returns -32601 Method Not Found for unknown tool name in tools/call', async () => {
    const request = {
      jsonrpc: '2.0',
      id: 'call-unknown',
      method: 'tools/call',
      params: {
        name: 'non_existent_tool',
        arguments: {},
      },
    };

    const response = await dispatchJsonRpc(request);
    expect(response).toMatchObject({
      jsonrpc: '2.0',
      id: 'call-unknown',
      error: {
        code: JSONRPC_ERRORS.METHOD_NOT_FOUND,
      },
    });
  });

  it('returns -32601 Method Not Found for completely unknown method', async () => {
    const request = {
      jsonrpc: '2.0',
      id: 'method-404',
      method: 'random_method_name',
    };

    const response = await dispatchJsonRpc(request);
    expect(response).toMatchObject({
      jsonrpc: '2.0',
      id: 'method-404',
      error: {
        code: JSONRPC_ERRORS.METHOD_NOT_FOUND,
      },
    });
  });

  it('returns -32600 Invalid Request when jsonrpc is missing or not "2.0"', async () => {
    const request = {
      jsonrpc: '1.0',
      id: 99,
      method: 'ping',
    };

    const response = await dispatchJsonRpc(request);
    expect(response).toMatchObject({
      jsonrpc: '2.0',
      id: 99,
      error: {
        code: JSONRPC_ERRORS.INVALID_REQUEST,
      },
    });
  });

  it('returns -32600 Invalid Request when body is not an object', async () => {
    const response = await dispatchJsonRpc('not an object');
    expect(response).toMatchObject({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: JSONRPC_ERRORS.INVALID_REQUEST,
      },
    });
  });

  it('returns -32603 Internal Error when tool handler throws unhandled exception', async () => {
    registerTool({
      name: 'failing_tool',
      description: 'Throws an error',
      inputSchema: { type: 'object' },
      handler: async () => {
        throw new Error('Database connection failed');
      },
    });

    const request = {
      jsonrpc: '2.0',
      id: 'fail-1',
      method: 'tools/call',
      params: {
        name: 'failing_tool',
        arguments: {},
      },
    };

    const response = await dispatchJsonRpc(request);
    expect(response).toMatchObject({
      jsonrpc: '2.0',
      id: 'fail-1',
      error: {
        code: JSONRPC_ERRORS.INTERNAL_ERROR,
        message: expect.stringContaining('Database connection failed'),
      },
    });
  });
});
