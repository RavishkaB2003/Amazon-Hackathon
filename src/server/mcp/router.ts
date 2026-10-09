/**
 * JSON-RPC 2.0 Router for Model Context Protocol
 */

import { z } from 'zod';
import type {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcId,
  RequestContext,
  InitializeResult,
  McpToolResult,
} from '../../shared/types/mcp';
import { JSONRPC_ERRORS } from '../../shared/types/mcp';
import { toolRegistry } from './registry';

const PROTOCOL_VERSION = '2025-11-25';
const SERVER_INFO = {
  name: 'aura-mcp-server',
  version: '1.0.0',
};

const JsonRpcEnvelopeSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  method: z.string().min(1),
  params: z.unknown().optional(),
});

const ToolsCallParamsSchema = z.object({
  name: z.string().min(1, 'Tool name is required'),
  arguments: z.record(z.unknown()).optional().default({}),
});

/**
 * Validates data against a JSON Schema draft-07 object definition.
 */
export function validateJsonSchema(
  schema: Record<string, unknown> | undefined,
  data: unknown
): { valid: boolean; errors: string[] } {
  if (!schema || Object.keys(schema).length === 0) {
    return { valid: true, errors: [] };
  }

  const errors: string[] = [];

  // Type check
  if (schema.type === 'object') {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      errors.push(`Expected object, received ${Array.isArray(data) ? 'array' : typeof data}`);
      return { valid: false, errors };
    }

    const obj = data as Record<string, unknown>;

    // Required properties
    if (Array.isArray(schema.required)) {
      for (const reqKey of schema.required as string[]) {
        if (!(reqKey in obj) || obj[reqKey] === undefined) {
          errors.push(`Missing required property: "${reqKey}"`);
        }
      }
    }

    // Properties check
    if (schema.properties && typeof schema.properties === 'object') {
      const props = schema.properties as Record<string, Record<string, unknown>>;
      for (const [key, propSchema] of Object.entries(props)) {
        if (key in obj && obj[key] !== undefined) {
          const val = obj[key];
          const valType = typeof val;

          if (propSchema.type) {
            if (propSchema.type === 'string' && valType !== 'string') {
              errors.push(`Property "${key}" expected string, received ${valType}`);
            } else if (propSchema.type === 'number' && (valType !== 'number' || Number.isNaN(val))) {
              errors.push(`Property "${key}" expected number, received ${valType}`);
            } else if (propSchema.type === 'integer' && (!Number.isInteger(val))) {
              errors.push(`Property "${key}" expected integer, received ${val}`);
            } else if (propSchema.type === 'boolean' && valType !== 'boolean') {
              errors.push(`Property "${key}" expected boolean, received ${valType}`);
            } else if (propSchema.type === 'array' && !Array.isArray(val)) {
              errors.push(`Property "${key}" expected array, received ${valType}`);
            } else if (propSchema.type === 'object' && (valType !== 'object' || val === null || Array.isArray(val))) {
              errors.push(`Property "${key}" expected object, received ${valType}`);
            }
          }

          if (Array.isArray(propSchema.enum) && !propSchema.enum.includes(val)) {
            errors.push(`Property "${key}" must be one of: ${propSchema.enum.join(', ')}`);
          }

          if (typeof propSchema.minimum === 'number' && typeof val === 'number' && val < propSchema.minimum) {
            errors.push(`Property "${key}" must be >= ${propSchema.minimum}`);
          }
          if (typeof propSchema.maximum === 'number' && typeof val === 'number' && val > propSchema.maximum) {
            errors.push(`Property "${key}" must be <= ${propSchema.maximum}`);
          }
          if (typeof propSchema.minLength === 'number' && typeof val === 'string' && val.length < propSchema.minLength) {
            errors.push(`Property "${key}" length must be >= ${propSchema.minLength}`);
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function createSuccessResponse<T>(id: JsonRpcId, result: T): JsonRpcResponse<T> {
  return {
    jsonrpc: '2.0',
    id: id ?? null,
    result,
  };
}

export function createErrorResponse(
  id: JsonRpcId,
  code: number,
  message: string,
  data?: unknown
): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id: id ?? null,
    error: {
      code,
      message,
      ...(data !== undefined ? { data } : {}),
    },
  };
}

/**
 * Dispatches a JSON-RPC 2.0 request to the appropriate protocol handler.
 */
export async function dispatchJsonRpc(
  rawBody: unknown,
  context: RequestContext = {}
): Promise<JsonRpcResponse> {
  // 1. Structure validation
  if (!rawBody || typeof rawBody !== 'object') {
    return createErrorResponse(
      null,
      JSONRPC_ERRORS.INVALID_REQUEST,
      'Invalid Request: Body must be a JSON object'
    );
  }

  const parseResult = JsonRpcEnvelopeSchema.safeParse(rawBody);
  if (!parseResult.success) {
    const rawObj = rawBody as Record<string, unknown>;
    const id = (typeof rawObj.id === 'string' || typeof rawObj.id === 'number') ? rawObj.id : null;
    const issues = parseResult.error.issues.map((i) => i.message).join('; ');
    return createErrorResponse(
      id,
      JSONRPC_ERRORS.INVALID_REQUEST,
      `Invalid Request: ${issues}`
    );
  }

  const request = parseResult.data as JsonRpcRequest;
  const id = request.id ?? null;

  try {
    switch (request.method) {
      case 'initialize': {
        const result: InitializeResult = {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: {
            tools: {
              listChanged: true,
            },
          },
          serverInfo: SERVER_INFO,
        };
        return createSuccessResponse(id, result);
      }

      case 'ping': {
        return createSuccessResponse(id, {});
      }

      case 'tools/list': {
        const tools = toolRegistry.listRegisteredTools().map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        }));
        return createSuccessResponse(id, { tools });
      }

      case 'tools/call': {
        const callParse = ToolsCallParamsSchema.safeParse(request.params);
        if (!callParse.success) {
          return createErrorResponse(
            id,
            JSONRPC_ERRORS.INVALID_PARAMS,
            `Invalid params: ${callParse.error.issues.map((i) => i.message).join('; ')}`
          );
        }

        const { name: toolName, arguments: toolArgs } = callParse.data;
        const tool = toolRegistry.getTool(toolName);

        if (!tool) {
          return createErrorResponse(
            id,
            JSONRPC_ERRORS.METHOD_NOT_FOUND,
            `Method not found: Tool "${toolName}" is not registered`,
            { tool: toolName }
          );
        }

        // Validate arguments against tool's inputSchema
        const schemaValidation = validateJsonSchema(tool.inputSchema, toolArgs);
        if (!schemaValidation.valid) {
          return createErrorResponse(
            id,
            JSONRPC_ERRORS.INVALID_PARAMS,
            `Invalid params for tool "${toolName}": ${schemaValidation.errors.join('; ')}`,
            { errors: schemaValidation.errors }
          );
        }

        // Execute tool handler
        const result: McpToolResult = await tool.handler(toolArgs || {}, context);
        return createSuccessResponse(id, result);
      }

      default: {
        return createErrorResponse(
          id,
          JSONRPC_ERRORS.METHOD_NOT_FOUND,
          `Method not found: ${request.method}`,
          { method: request.method }
        );
      }
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return createErrorResponse(
      id,
      JSONRPC_ERRORS.INTERNAL_ERROR,
      `Internal error: ${errorMsg}`,
      { error: errorMsg }
    );
  }
}
