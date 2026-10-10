/**
 * Integration Test Suite for MOD-03 Bedrock Converse & Graceful Fallback
 * CHK-MOD-03-CONVERSE: Converse API payload formatting, toolConfig transformation, and model ID.
 * CHK-MOD-03-FALLBACK: Resilient fallback from Bedrock failures (429, 500, credentials)
 * to offline mock engine without breaking client connection (NFR-006).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createMcpServer, clearCart } from '../../../src/server';
import { AgentService } from '../../../src/server/agent/agent';
import { BedrockClient, DEFAULT_BEDROCK_MODEL_ID } from '../../../src/server/agent/bedrock-client';
import { listRegisteredTools } from '../../../src/server/mcp/registry';
import { registerCoreTools } from '../../../src/server/mcp/tools';

describe('CHK-MOD-03-CONVERSE: Bedrock Converse Specifications', () => {
  beforeEach(() => {
    registerCoreTools();
  });

  it('targets Claude 3.5 Sonnet v2 model ID by default', () => {
    const client = new BedrockClient();
    expect(client.getModelId()).toBe('anthropic.claude-3-5-sonnet-20241022-v2:0');
    expect(DEFAULT_BEDROCK_MODEL_ID).toBe('anthropic.claude-3-5-sonnet-20241022-v2:0');
  });

  it('correctly transforms registered MCP tools into Bedrock toolConfig toolSpec schemas', () => {
    const client = new BedrockClient();
    const registered = listRegisteredTools();
    expect(registered.length).toBeGreaterThanOrEqual(4);

    const bedrockSpecs = client.formatMcpToolsForBedrock(registered);
    expect(bedrockSpecs.length).toBe(registered.length);

    for (const spec of bedrockSpecs) {
      expect(spec.toolSpec).toBeDefined();
      expect(spec.toolSpec.name).toBeDefined();
      expect(typeof spec.toolSpec.name).toBe('string');
      expect(spec.toolSpec.inputSchema).toBeDefined();
      expect(spec.toolSpec.inputSchema.json).toBeDefined();
    }

    const toolNames = bedrockSpecs.map((s) => s.toolSpec.name);
    expect(toolNames).toContain('smart_search_catalog');
    expect(toolNames).toContain('build_curated_bundle');
    expect(toolNames).toContain('render_multimodal_widget');
    expect(toolNames).toContain('manage_cart');
  });
});

describe('CHK-MOD-03-FALLBACK: Resilient Error Handling & Graceful Fallback (NFR-006)', () => {
  const originalEnv = { ...process.env };
  let server: FastifyInstance;

  beforeEach(async () => {
    // Configure environment to appear as live Bedrock mode
    process.env.AWS_ACCESS_KEY_ID = 'AKIAIOSFODNN7EXAMPLE';
    process.env.AWS_SECRET_ACCESS_KEY = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
    delete process.env.AWS_MOCK_MODE;
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    if (server) {
      await server.close();
    }
  });

  it('gracefully falls back to mock engine when Bedrock throws ThrottlingException (HTTP 429)', async () => {
    const customAgent = new AgentService({ mockMode: false });

    // Mock Bedrock client converse method to throw ThrottlingException
    vi.spyOn((customAgent as any).bedrockClient, 'converse').mockRejectedValue(
      new Error('ThrottlingException: Rate exceeded (HTTP 429)')
    );

    const response = await customAgent.chat({
      sessionId: 'session-fallback-429',
      message: 'Quick dinner under $25 for two',
      persona: 'alex',
    });

    expect(response.fallbackTriggered).toBe(true);
    expect(response.spokenText).toBeDefined();
    expect(response.wordCount).toBeLessThan(25);
    expect(response.toolCallsExecuted.length).toBeGreaterThan(0);
    expect(response.widgetsDispatched.length).toBeGreaterThan(0);
  });

  it('gracefully falls back to mock engine when Bedrock throws InternalServerException (HTTP 500)', async () => {
    const customAgent = new AgentService({ mockMode: false });

    vi.spyOn((customAgent as any).bedrockClient, 'converse').mockRejectedValue(
      new Error('InternalServerException: Bedrock internal error (HTTP 500)')
    );

    const response = await customAgent.chat({
      sessionId: 'session-fallback-500',
      message: 'Mediterranean salmon under $30, dairy-free',
      persona: 'elena',
    });

    expect(response.fallbackTriggered).toBe(true);
    expect(response.spokenText).toBeDefined();
    expect(response.wordCount).toBeLessThan(25);
    expect(response.widgetsDispatched.length).toBeGreaterThan(0);
  });

  it('gracefully falls back when invalid/expired credentials cause UnrecognizedClientException', async () => {
    const customAgent = new AgentService({ mockMode: false });

    vi.spyOn((customAgent as any).bedrockClient, 'converse').mockRejectedValue(
      new Error('UnrecognizedClientException: The security token included in the request is invalid')
    );

    const response = await customAgent.chat({
      sessionId: 'session-fallback-unrecognized',
      message: 'High-protein grain bowl',
      persona: 'marcus',
    });

    expect(response.fallbackTriggered).toBe(true);
    expect(response.spokenText).toBeDefined();
    expect(response.wordCount).toBeLessThan(25);
  });

  it('emits X-Bedrock-Fallback: true HTTP header on Fastify endpoint when fallback triggers', async () => {
    const customAgent = new AgentService({ mockMode: false });

    vi.spyOn((customAgent as any).bedrockClient, 'converse').mockRejectedValue(
      new Error('ThrottlingException: HTTP 429')
    );

    server = await createMcpServer({
      host: '127.0.0.1',
      agentService: customAgent,
    });
    await server.ready();

    const response = await server.inject({
      method: 'POST',
      url: '/agent/chat',
      payload: {
        sessionId: 'session-fallback-http',
        message: 'Quick high-protein dinner under $25 for two. No dairy.',
        persona: 'alex',
        stream: false,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-bedrock-fallback']).toBe('true');

    const body = JSON.parse(response.body);
    expect(body.fallbackTriggered).toBe(true);
    expect(body.wordCount).toBeLessThan(25);
  });

  it('handles streaming fallback seamlessly without breaking client SSE stream', async () => {
    const customAgent = new AgentService({ mockMode: false });

    vi.spyOn((customAgent as any).bedrockClient, 'converse').mockRejectedValue(
      new Error('ThrottlingException: 429')
    );

    server = await createMcpServer({
      host: '127.0.0.1',
      agentService: customAgent,
    });
    await server.ready();

    const response = await server.inject({
      method: 'POST',
      url: '/agent/chat',
      headers: {
        'content-type': 'application/json',
        'accept': 'text/event-stream',
      },
      payload: {
        sessionId: 'session-fallback-sse',
        message: 'Mediterranean salmon under $30, dairy-free',
        persona: 'elena',
        stream: true,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');

    const streamBody = response.body;
    expect(streamBody).toContain('event: token');
    expect(streamBody).toContain('event: done');

    const doneMatch = streamBody.match(/event: done\s+data: ({.*?})/);
    expect(doneMatch).not.toBeNull();
    const donePayload = JSON.parse(doneMatch![1]);
    expect(donePayload.fallbackTriggered).toBe(true);
    expect(donePayload.wordCount).toBeLessThan(25);
  });
});
