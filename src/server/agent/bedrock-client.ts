/**
 * Aura+ MOD-03 Bedrock Runtime Client Wrapper
 * Handles Converse and ConverseStream operations targeting Claude 3.5 Sonnet
 * (anthropic.claude-3-5-sonnet-20241022-v2:0).
 * Enforces SEC-002 AWS credential isolation and MCP toolConfig transformation.
 */

import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
  type ConverseCommandInput,
  type ConverseStreamCommandInput,
  type ConverseCommandOutput,
  type ConverseStreamCommandOutput,
} from '@aws-sdk/client-bedrock-runtime';
import type { McpToolRegistration } from '../../shared/types/mcp';
import type { BedrockConversePayload, BedrockToolSpec } from '../../shared/types/agent';

export const DEFAULT_BEDROCK_MODEL_ID = 'anthropic.claude-3-5-sonnet-20241022-v2:0';
export const DEFAULT_AWS_REGION = 'us-east-1';

export class BedrockClient {
  private client: BedrockRuntimeClient | null = null;
  private modelId: string;
  private region: string;

  constructor(options: { modelId?: string; region?: string } = {}) {
    this.modelId =
      options.modelId ||
      process.env.AWS_BEDROCK_MODEL_ID ||
      DEFAULT_BEDROCK_MODEL_ID;
    this.region =
      options.region ||
      process.env.AWS_REGION ||
      DEFAULT_AWS_REGION;
  }

  /**
   * Checks whether valid AWS credentials exist in environment variables (SEC-002).
   */
  hasValidCredentials(): boolean {
    if (process.env.AWS_MOCK_MODE === 'true') {
      return false;
    }

    const keyId = process.env.AWS_ACCESS_KEY_ID?.trim();
    const secretKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();

    // Check for dummy/empty/placeholder credentials
    if (!keyId || !secretKey) {
      return false;
    }

    if (keyId === 'mock' || secretKey === 'mock' || keyId === 'dummy' || secretKey === 'dummy') {
      return false;
    }

    return true;
  }

  /**
   * Returns or lazily initializes the AWS Bedrock client.
   */
  getClient(): BedrockRuntimeClient {
    if (!this.client) {
      const credentials = this.hasValidCredentials()
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!.trim(),
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!.trim(),
            ...(process.env.AWS_SESSION_TOKEN ? { sessionToken: process.env.AWS_SESSION_TOKEN.trim() } : {}),
          }
        : undefined;

      this.client = new BedrockRuntimeClient({
        region: this.region,
        ...(credentials ? { credentials } : {}),
      });
    }

    return this.client;
  }

  /**
   * Formats MCP tool definitions into Bedrock Converse toolConfig specifications.
   */
  formatMcpToolsForBedrock(tools: McpToolRegistration[]): BedrockToolSpec[] {
    return tools.map((tool) => ({
      toolSpec: {
        name: tool.name,
        description: tool.description,
        inputSchema: {
          json: tool.inputSchema as Record<string, unknown>,
        },
      },
    }));
  }

  /**
   * Executes a standard non-streaming ConverseCommand.
   */
  async converse(payload: BedrockConversePayload): Promise<ConverseCommandOutput> {
    const client = this.getClient();
    const input: ConverseCommandInput = {
      modelId: payload.modelId || this.modelId,
      messages: payload.messages as ConverseCommandInput['messages'],
      system: payload.system,
      inferenceConfig: payload.inferenceConfig,
      toolConfig: payload.toolConfig as ConverseCommandInput['toolConfig'],
    };

    const command = new ConverseCommand(input);
    return await client.send(command);
  }

  /**
   * Executes a streaming ConverseStreamCommand.
   */
  async converseStream(payload: BedrockConversePayload): Promise<ConverseStreamCommandOutput> {
    const client = this.getClient();
    const input: ConverseStreamCommandInput = {
      modelId: payload.modelId || this.modelId,
      messages: payload.messages as ConverseStreamCommandInput['messages'],
      system: payload.system,
      inferenceConfig: payload.inferenceConfig,
      toolConfig: payload.toolConfig as ConverseStreamCommandInput['toolConfig'],
    };

    const command = new ConverseStreamCommand(input);
    return await client.send(command);
  }

  getModelId(): string {
    return this.modelId;
  }

  getRegion(): string {
    return this.region;
  }
}

export const bedrockClient = new BedrockClient();
