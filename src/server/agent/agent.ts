/**
 * Aura+ MOD-03 Dual-Mode Bedrock Agent Service
 * Orchestrates multi-turn tool reasoning, ambient constraint parsing,
 * spoken brevity enforcement (< 25 words), ephemeral in-memory sessions,
 * and resilient automatic fallback from live Bedrock to mock engine (NFR-006).
 */

import { listRegisteredTools, getTool } from '../mcp/registry';
import {
  type AgentChatRequest,
  type AgentChatResponse,
  type AgentStreamChunk,
  type AgentServiceOptions,
  type AgentMessage,
  type ToolCallExecutionRecord,
  type WidgetDispatchedRecord,
  type BedrockConversePayload,
} from '../../shared/types/agent';
import {
  AURA_SYSTEM_PROMPT,
  countWords,
  trimSpokenText,
  MAX_SPOKEN_WORDS_DEFAULT,
} from './prompts';
import { agentMemory, isPurgeCommand, AgentMemoryStore } from './memory';
import { MockEngine, mockEngine } from './mock-engine';
import { BedrockClient, bedrockClient } from './bedrock-client';

export const MAX_TOOL_ITERATIONS_DEFAULT = 5;

export class AgentService {
  private mockModeOption?: boolean;
  private maxToolIterations: number;
  private maxWordsSpoken: number;
  private bedrockClient: BedrockClient;
  private mockEngine: MockEngine;
  private memory: AgentMemoryStore;

  constructor(options: AgentServiceOptions = {}) {
    this.mockModeOption = options.mockMode;
    this.maxToolIterations = options.maxToolIterations || MAX_TOOL_ITERATIONS_DEFAULT;
    this.maxWordsSpoken = options.maxWordsSpoken || MAX_SPOKEN_WORDS_DEFAULT;
    this.bedrockClient = new BedrockClient({
      modelId: options.modelId,
      region: options.region,
    });
    this.mockEngine = mockEngine;
    this.memory = agentMemory;
  }

  /**
   * Introspects whether the agent is currently configured to execute in offline mock mode.
   */
  isMockMode(): boolean {
    if (this.mockModeOption === true) {
      return true;
    }
    if (process.env.AWS_MOCK_MODE === 'true') {
      return true;
    }
    return !this.bedrockClient.hasValidCredentials();
  }

  /**
   * Executes a conversational chat turn with multi-turn tool calling and graceful fallback.
   */
  async chat(request: AgentChatRequest): Promise<AgentChatResponse> {
    const { sessionId, message } = request;

    // 1. Session Purge Command (PRIV-002, CTRL-05)
    if (isPurgeCommand(message)) {
      this.clearSession(sessionId);
      const spokenText = "I've cleared your session history and shopping cart.";
      return {
        sessionId,
        spokenText,
        wordCount: countWords(spokenText),
        toolCallsExecuted: [
          {
            toolName: 'manage_cart',
            input: { action: 'clear', sessionId },
            output: { itemCount: 0, total: 0.0 },
          },
        ],
        widgetsDispatched: [],
        fallbackTriggered: false,
        modelUsed: 'system-purge',
        turnCount: 0,
      };
    }

    // Record user message in ephemeral sliding-window memory
    this.memory.addMessage(sessionId, {
      role: 'user',
      content: [{ text: message }],
    });

    // 2. Offline Mock Engine execution
    if (this.isMockMode()) {
      const response = await this.mockEngine.chat(request, false);
      this.recordAssistantResponse(sessionId, response);
      return response;
    }

    // 3. Live Amazon Bedrock execution with automatic graceful fallback (NFR-006)
    try {
      const response = await this.executeBedrockTurn(request);
      this.recordAssistantResponse(sessionId, response);
      return response;
    } catch (err) {
      // Graceful fallback interception: catch 429 throttling, 500 internal errors,
      // and credential/network errors without dropping request
      console.warn(
        `[AgentService] Bedrock execution failed, activating seamless mock fallback: ${(err as Error)?.message}`
      );

      const fallbackResponse = await this.mockEngine.chat(request, true);
      this.recordAssistantResponse(sessionId, fallbackResponse);
      return fallbackResponse;
    }
  }

  /**
   * Streams a conversational turn emitting token deltas, tool calls, and widgets over SSE.
   */
  async *chatStream(request: AgentChatRequest): AsyncIterable<AgentStreamChunk> {
    const { sessionId, message } = request;

    // 1. Session Purge Command
    if (isPurgeCommand(message)) {
      this.clearSession(sessionId);
      yield* this.mockEngine.chatStream(request, false);
      return;
    }

    // Record user message
    this.memory.addMessage(sessionId, {
      role: 'user',
      content: [{ text: message }],
    });

    // 2. Offline Mock Engine streaming
    if (this.isMockMode()) {
      let finalSpokenText = '';
      for await (const chunk of this.mockEngine.chatStream(request, false)) {
        if (chunk.type === 'done') {
          finalSpokenText = chunk.spokenText;
        }
        yield chunk;
      }
      if (finalSpokenText) {
        this.memory.addMessage(sessionId, {
          role: 'assistant',
          content: [{ text: finalSpokenText }],
        });
      }
      return;
    }

    // 3. Live Bedrock streaming with fallback wrapper
    try {
      const chunks = this.executeBedrockStream(request);
      let finalSpokenText = '';
      for await (const chunk of chunks) {
        if (chunk.type === 'done') {
          finalSpokenText = chunk.spokenText;
        }
        yield chunk;
      }
      if (finalSpokenText) {
        this.memory.addMessage(sessionId, {
          role: 'assistant',
          content: [{ text: finalSpokenText }],
        });
      }
    } catch (err) {
      console.warn(
        `[AgentService] Bedrock stream failed, activating seamless mock fallback: ${(err as Error)?.message}`
      );
      yield* this.mockEngine.chatStream(request, true);
    }
  }

  /**
   * Returns ephemeral sliding-window message history for a given session.
   */
  getSessionHistory(sessionId: string): AgentMessage[] {
    return this.memory.getSessionHistory(sessionId);
  }

  /**
   * Wipes session memory from RAM and clears staged shopping cart items (PRIV-002).
   */
  clearSession(sessionId: string): void {
    this.memory.clearSession(sessionId);
  }

  /**
   * Returns the count of currently active in-memory sessions.
   */
  getActiveSessionCount(): number {
    return this.memory.getActiveSessionCount();
  }

  /**
   * Executes the multi-turn Bedrock Converse tool loop.
   */
  private async executeBedrockTurn(request: AgentChatRequest): Promise<AgentChatResponse> {
    const { sessionId } = request;
    const registeredTools = listRegisteredTools();
    const bedrockTools = this.bedrockClient.formatMcpToolsForBedrock(registeredTools);

    const toolCallsExecuted: ToolCallExecutionRecord[] = [];
    const widgetsDispatched: WidgetDispatchedRecord[] = [];

    // Build Converse message history
    const history = this.memory.getSessionHistory(sessionId);
    const converseMessages = this.formatConverseMessages(history);

    let iteration = 0;
    let finalSpokenText = '';

    while (iteration < this.maxToolIterations) {
      iteration++;

      const payload: BedrockConversePayload = {
        modelId: this.bedrockClient.getModelId(),
        messages: converseMessages,
        system: [{ text: AURA_SYSTEM_PROMPT }],
        inferenceConfig: {
          maxTokens: 1024,
          temperature: 0.2,
          topP: 0.9,
        },
        toolConfig: {
          tools: bedrockTools,
          toolChoice: { auto: {} },
        },
      };

      const converseOutput = await this.bedrockClient.converse(payload);
      const assistantMessage = converseOutput.output?.message;
      if (!assistantMessage) {
        break;
      }

      // Add assistant message to local turn conversation
      converseMessages.push({
        role: 'assistant',
        content: assistantMessage.content as any,
      });

      // Extract toolUse content blocks
      const toolUseBlocks = (assistantMessage.content || []).filter(
        (block: any) => block.toolUse
      );

      // Extract spoken text blocks
      const textBlocks = (assistantMessage.content || []).filter(
        (block: any) => block.text
      );
      if (textBlocks.length > 0) {
        finalSpokenText = textBlocks.map((b: any) => b.text).join(' ');
      }

      if (toolUseBlocks.length === 0 || converseOutput.stopReason === 'end_turn') {
        break;
      }

      // Execute each tool use
      const toolResultsContent: any[] = [];
      for (const block of toolUseBlocks) {
        if (!block.toolUse || !block.toolUse.toolUseId || !block.toolUse.name) {
          continue;
        }
        const toolUseId = block.toolUse.toolUseId;
        const toolName = block.toolUse.name;
        const input = (block.toolUse.input as Record<string, unknown>) || {};
        const tool = getTool(toolName);

        let toolOutput: Record<string, unknown> = {};
        if (tool) {
          const res = await tool.handler(input, { sessionId });
          try {
            toolOutput = JSON.parse(res.content[0]?.text || '{}');
          } catch {
            toolOutput = { result: res.content[0]?.text || '' };
          }
        } else {
          toolOutput = { error: `Tool ${toolName} not found` };
        }

        toolCallsExecuted.push({
          toolName,
          input,
          output: toolOutput,
        });

        if (toolName === 'render_multimodal_widget') {
          widgetsDispatched.push({
            widgetType: (input.widgetType as string) || 'recipe_card',
            title: (input.title as string) || 'Meal Plan',
          });
        }

        toolResultsContent.push({
          toolResult: {
            toolUseId,
            content: [{ json: toolOutput }],
            status: 'success',
          },
        });
      }

      // Append toolResults as a user message
      converseMessages.push({
        role: 'user',
        content: toolResultsContent,
      });
    }

    // Enforce spoken brevity constraint (< 25 words)
    let spokenText = finalSpokenText || "I've assembled your meal plan and updated your cart.";
    if (countWords(spokenText) > this.maxWordsSpoken) {
      spokenText = trimSpokenText(spokenText, this.maxWordsSpoken);
    }

    return {
      sessionId,
      spokenText,
      wordCount: countWords(spokenText),
      toolCallsExecuted,
      widgetsDispatched,
      fallbackTriggered: false,
      modelUsed: this.bedrockClient.getModelId(),
      turnCount: iteration,
    };
  }

  /**
   * Executes streaming Bedrock Converse turn.
   */
  private async *executeBedrockStream(
    request: AgentChatRequest
  ): AsyncIterable<AgentStreamChunk> {
    // If live stream is initiated, we execute turn and yield streaming chunks
    const response = await this.executeBedrockTurn(request);

    // Yield tool calls
    for (const tool of response.toolCallsExecuted) {
      yield {
        type: 'tool_call',
        toolName: tool.toolName,
        toolUseId: `call_${Date.now()}_${tool.toolName}`,
        input: tool.input,
      };
      yield {
        type: 'tool_result',
        toolUseId: `call_${Date.now()}_${tool.toolName}`,
        result: tool.output,
      };
    }

    // Yield widgets
    for (const widget of response.widgetsDispatched) {
      yield {
        type: 'widget',
        widgetType: widget.widgetType,
        title: widget.title,
        payload: {},
      };
    }

    // Yield spoken tokens
    const words = response.spokenText.split(' ');
    for (let i = 0; i < words.length; i++) {
      yield {
        type: 'token',
        text: (i === 0 ? '' : ' ') + words[i],
      };
    }

    // Yield completion
    yield {
      type: 'done',
      spokenText: response.spokenText,
      wordCount: response.wordCount,
      fallbackTriggered: response.fallbackTriggered,
    };
  }

  /**
   * Transforms AgentMessage[] into Bedrock Converse message format.
   */
  private formatConverseMessages(messages: AgentMessage[]): any[] {
    return messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role,
        content: m.content.map((block) => {
          if ('text' in block) {
            return { text: block.text };
          }
          if ('toolUse' in block) {
            return { toolUse: block.toolUse };
          }
          if ('toolResult' in block) {
            return { toolResult: block.toolResult };
          }
          return { text: '' };
        }),
      }));
  }

  /**
   * Records assistant response into session memory.
   */
  private recordAssistantResponse(sessionId: string, response: AgentChatResponse): void {
    if (response.spokenText) {
      this.memory.addMessage(sessionId, {
        role: 'assistant',
        content: [{ text: response.spokenText }],
      });
    }
  }
}

export const agentService = new AgentService();
