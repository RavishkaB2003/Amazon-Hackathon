/**
 * MCP Core & Transport Type Definitions
 * Model Context Protocol (Spec 2025-11-25)
 */

export type JsonRpcId = string | number | null;

export interface JsonRpcRequest<TParams = Record<string, unknown>> {
  jsonrpc: '2.0';
  id?: JsonRpcId;
  method: string;
  params?: TParams;
}

export interface JsonRpcSuccessResponse<TResult = unknown> {
  jsonrpc: '2.0';
  id: JsonRpcId;
  result: TResult;
}

export interface JsonRpcErrorObject {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcErrorResponse {
  jsonrpc: '2.0';
  id: JsonRpcId;
  error: JsonRpcErrorObject;
}

export type JsonRpcResponse<TResult = unknown> =
  | JsonRpcSuccessResponse<TResult>
  | JsonRpcErrorResponse;

export const JSONRPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  RATE_LIMITED: -32000,
} as const;

export interface RequestContext {
  sessionId?: string;
  requestId?: string;
  idempotencyKey?: string;
  clientIp?: string;
}

export interface McpContentItem {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
  resource?: unknown;
}

export interface McpToolResult {
  content: McpContentItem[];
  isError?: boolean;
}

export interface McpToolRegistration {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>; // JSON Schema draft-07
  handler: (params: Record<string, unknown>, context: RequestContext) => Promise<McpToolResult>;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ServerInfo {
  name: string;
  version: string;
}

export interface ClientInfo {
  name: string;
  version: string;
}

export interface ServerCapabilities {
  tools?: {
    listChanged?: boolean;
  };
  logging?: Record<string, unknown>;
  prompts?: Record<string, unknown>;
  resources?: Record<string, unknown>;
}

export interface InitializeParams {
  protocolVersion: string;
  capabilities?: Record<string, unknown>;
  clientInfo?: ClientInfo;
}

export interface InitializeResult {
  protocolVersion: string;
  capabilities: ServerCapabilities;
  serverInfo: ServerInfo;
}

export interface ToolsCallParams {
  name: string;
  arguments?: Record<string, unknown>;
}

export interface McpSseEvent {
  event?: string;
  data: Record<string, unknown>;
  id?: string;
}

export interface ServerOptions {
  port?: number;
  host?: string;
  rateLimitMax?: number;
  rateLimitWindowMs?: number;
  heartbeatIntervalMs?: number;
}
