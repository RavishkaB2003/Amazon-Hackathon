/**
 * Aura+ MOD-03 Dual-Mode Bedrock Agent Type Definitions & Schemas
 * Type contracts for Bedrock Converse runtime, streaming SSE events,
 * ephemeral session memory, ambient constraints, and persona configurations.
 */

import { z } from 'zod';

// ==========================================
// 1. Persona & Ambient Constraints Types
// ==========================================

export type PersonaType = 'alex' | 'elena' | 'marcus' | 'custom';

export interface AmbientConstraints {
  maxBudget?: number;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  servings?: number;
  excludedAllergens?: string[];
  dietaryTags?: string[];
  targetProteinG?: number;
}

export const AmbientConstraintsSchema = z.object({
  maxBudget: z.number().positive().optional(),
  prepTimeMinutes: z.number().positive().optional(),
  cookTimeMinutes: z.number().positive().optional(),
  servings: z.number().int().positive().optional(),
  excludedAllergens: z.array(z.string()).optional(),
  dietaryTags: z.array(z.string()).optional(),
  targetProteinG: z.number().positive().optional(),
});

// ==========================================
// 2. Conversational Message & Memory Types
// ==========================================

export type AgentRole = 'user' | 'assistant' | 'system';

export interface AgentTextBlock {
  text: string;
}

export interface AgentToolUseBlock {
  toolUse: {
    toolUseId: string;
    name: string;
    input: Record<string, unknown>;
  };
}

export interface AgentToolResultBlock {
  toolResult: {
    toolUseId: string;
    content: Array<{ json?: unknown; text?: string }>;
    status?: 'success' | 'error';
  };
}

export type AgentContentBlock =
  | AgentTextBlock
  | AgentToolUseBlock
  | AgentToolResultBlock;

export interface AgentMessage {
  role: AgentRole;
  content: AgentContentBlock[];
  timestamp: number;
}

export const AgentContentBlockSchema = z.union([
  z.object({
    text: z.string(),
  }),
  z.object({
    toolUse: z.object({
      toolUseId: z.string().min(1),
      name: z.string().min(1),
      input: z.record(z.unknown()),
    }),
  }),
  z.object({
    toolResult: z.object({
      toolUseId: z.string().min(1),
      content: z.array(
        z.object({
          json: z.unknown().optional(),
          text: z.string().optional(),
        })
      ),
      status: z.enum(['success', 'error']).optional(),
    }),
  }),
]);

export const AgentMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.array(AgentContentBlockSchema),
  timestamp: z.number().nonnegative(),
});

export interface AgentSession {
  sessionId: string;
  messages: AgentMessage[];
  createdAt: number;
  lastActivityAt: number;
}

// ==========================================
// 3. Bedrock Converse Types & Tool Specs
// ==========================================

export interface BedrockToolSpec {
  toolSpec: {
    name: string;
    description?: string;
    inputSchema: {
      json: Record<string, unknown>;
    };
  };
}

export interface BedrockConversePayload {
  modelId: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: Array<
      | { text: string }
      | {
          toolUse: {
            toolUseId: string;
            name: string;
            input: Record<string, unknown>;
          };
        }
      | {
          toolResult: {
            toolUseId: string;
            content: Array<{ json?: unknown; text?: string }>;
            status?: 'success' | 'error';
          };
        }
    >;
  }>;
  system: Array<{ text: string }>;
  inferenceConfig: {
    maxTokens: number;
    temperature: number;
    topP: number;
  };
  toolConfig?: {
    tools: BedrockToolSpec[];
    toolChoice?: {
      auto: Record<string, unknown>;
    };
  };
}

export interface AgentPromptConfig {
  systemPrompt: string;
  toolSpecs: BedrockToolSpec[];
}

// ==========================================
// 4. Agent Service Request & Response Contracts
// ==========================================

export interface AgentServiceOptions {
  mockMode?: boolean;
  region?: string;
  modelId?: string;
  maxTurns?: number;
  maxToolIterations?: number;
  maxWordsSpoken?: number;
}

export const AgentServiceOptionsSchema = z.object({
  mockMode: z.boolean().optional(),
  region: z.string().optional(),
  modelId: z.string().optional(),
  maxTurns: z.number().int().positive().optional(),
  maxToolIterations: z.number().int().positive().optional(),
  maxWordsSpoken: z.number().int().positive().optional(),
});

export interface AgentChatRequest {
  sessionId: string;
  message: string;
  stream?: boolean;
  persona?: PersonaType;
}

export const AgentChatRequestSchema = z.object({
  sessionId: z.string().min(1),
  message: z.string().min(1),
  stream: z.boolean().optional(),
  persona: z.enum(['alex', 'elena', 'marcus', 'custom']).optional(),
});

export interface ToolCallExecutionRecord {
  toolName: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
}

export interface WidgetDispatchedRecord {
  widgetType: string;
  title: string;
}

export interface AgentChatResponse {
  sessionId: string;
  spokenText: string;
  wordCount: number;
  toolCallsExecuted: ToolCallExecutionRecord[];
  widgetsDispatched: WidgetDispatchedRecord[];
  fallbackTriggered: boolean;
  modelUsed: string;
  turnCount: number;
}

// ==========================================
// 5. Streaming Chunk Types
// ==========================================

export type AgentStreamChunk =
  | { type: 'token'; text: string }
  | { type: 'tool_call'; toolName: string; toolUseId: string; input: Record<string, unknown> }
  | { type: 'tool_result'; toolUseId: string; result: unknown }
  | { type: 'widget'; widgetType: string; title: string; payload: Record<string, unknown> }
  | { type: 'done'; spokenText: string; wordCount: number; fallbackTriggered: boolean }
  | { type: 'error'; message: string; code?: string };
