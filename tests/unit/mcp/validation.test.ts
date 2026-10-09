import { describe, it, expect, beforeEach } from 'vitest';
import { validateJsonSchema, dispatchJsonRpc } from '../../../src/server/mcp/router';
import { registerTool, clearTools } from '../../../src/server/mcp/registry';
import { JSONRPC_ERRORS } from '../../../src/shared/types/mcp';

describe('MCP Schema & Parameter Validation (Unit)', () => {
  beforeEach(() => {
    clearTools();
  });

  describe('validateJsonSchema', () => {
    const userSchema = {
      type: 'object',
      properties: {
        username: { type: 'string', minLength: 3 },
        age: { type: 'integer', minimum: 18, maximum: 120 },
        role: { type: 'string', enum: ['admin', 'user', 'guest'] },
        tags: { type: 'array' },
        isActive: { type: 'boolean' },
      },
      required: ['username', 'role'],
    };

    it('validates compliant object successfully', () => {
      const data = {
        username: 'alice',
        age: 25,
        role: 'admin',
        tags: ['editor'],
        isActive: true,
      };

      const result = validateJsonSchema(userSchema, data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('fails when required property is missing', () => {
      const data = {
        age: 25,
        role: 'admin',
      };

      const result = validateJsonSchema(userSchema, data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required property: "username"');
    });

    it('fails when type does not match', () => {
      const data = {
        username: 12345, // should be string
        role: 'admin',
      };

      const result = validateJsonSchema(userSchema, data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Property "username" expected string, received number');
    });

    it('fails when integer check fails (float passed)', () => {
      const data = {
        username: 'bob',
        age: 25.5, // float instead of integer
        role: 'user',
      };

      const result = validateJsonSchema(userSchema, data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Property "age" expected integer, received 25.5');
    });

    it('fails when enum constraint violated', () => {
      const data = {
        username: 'bob',
        role: 'superadmin', // not in enum
      };

      const result = validateJsonSchema(userSchema, data);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('must be one of: admin, user, guest');
    });

    it('fails when minimum constraint violated', () => {
      const data = {
        username: 'bob',
        age: 12, // < 18
        role: 'user',
      };

      const result = validateJsonSchema(userSchema, data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Property "age" must be >= 18');
    });
  });

  describe('tools/call parameter gating via dispatchJsonRpc', () => {
    beforeEach(() => {
      registerTool({
        name: 'create_order',
        description: 'Creates a simulated order',
        inputSchema: {
          type: 'object',
          properties: {
            productId: { type: 'string' },
            quantity: { type: 'integer', minimum: 1 },
          },
          required: ['productId', 'quantity'],
        },
        handler: async (args) => ({
          content: [{ type: 'text', text: `Order created for ${args.productId} x ${args.quantity}` }],
        }),
      });
    });

    it('rejects missing required parameters with -32602 Invalid Params', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 'val-1',
        method: 'tools/call',
        params: {
          name: 'create_order',
          arguments: {
            productId: 'prod-123',
            // missing quantity
          },
        },
      };

      const response = await dispatchJsonRpc(request);
      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: 'val-1',
        error: {
          code: JSONRPC_ERRORS.INVALID_PARAMS,
          message: expect.stringContaining('Missing required property: "quantity"'),
        },
      });
    });

    it('rejects invalid parameter type with -32602 Invalid Params', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 'val-2',
        method: 'tools/call',
        params: {
          name: 'create_order',
          arguments: {
            productId: 'prod-123',
            quantity: 'ten', // should be integer
          },
        },
      };

      const response = await dispatchJsonRpc(request);
      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: 'val-2',
        error: {
          code: JSONRPC_ERRORS.INVALID_PARAMS,
          message: expect.stringContaining('Property "quantity" expected integer'),
        },
      });
    });

    it('rejects constraint violation with -32602 Invalid Params', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 'val-3',
        method: 'tools/call',
        params: {
          name: 'create_order',
          arguments: {
            productId: 'prod-123',
            quantity: 0, // must be >= 1
          },
        },
      };

      const response = await dispatchJsonRpc(request);
      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: 'val-3',
        error: {
          code: JSONRPC_ERRORS.INVALID_PARAMS,
          message: expect.stringContaining('Property "quantity" must be >= 1'),
        },
      });
    });

    it('executes tool when parameters strictly conform to schema', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 'val-pass',
        method: 'tools/call',
        params: {
          name: 'create_order',
          arguments: {
            productId: 'prod-123',
            quantity: 2,
          },
        },
      };

      const response = await dispatchJsonRpc(request);
      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 'val-pass',
        result: {
          content: [{ type: 'text', text: 'Order created for prod-123 x 2' }],
        },
      });
    });
  });
});
