/**
 * Unit Test Suite for MOD-03 AWS Credential Isolation & Security Guard
 * CHK-MOD-03-CREDENTIALS (SEC-002, CTRL-06):
 * Verifies credentials are read only from env, never hardcoded, never leaked in output,
 * and that missing credentials gracefully activates mock mode without errors.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { BedrockClient } from '../../../src/server/agent/bedrock-client';
import { AgentService } from '../../../src/server/agent/agent';

describe('AWS Credential Isolation Guard (SEC-002, CTRL-06)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset env before each test
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_SESSION_TOKEN;
    delete process.env.AWS_MOCK_MODE;
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  it('reports hasValidCredentials as false when credentials are empty or missing', () => {
    const client = new BedrockClient();
    expect(client.hasValidCredentials()).toBe(false);

    const agent = new AgentService();
    expect(agent.isMockMode()).toBe(true);
  });

  it('reports hasValidCredentials as false when placeholder values (mock/dummy) are set', () => {
    process.env.AWS_ACCESS_KEY_ID = 'mock';
    process.env.AWS_SECRET_ACCESS_KEY = 'mock';

    const client = new BedrockClient();
    expect(client.hasValidCredentials()).toBe(false);

    const agent = new AgentService();
    expect(agent.isMockMode()).toBe(true);
  });

  it('respects explicit AWS_MOCK_MODE=true flag even when keys are present', () => {
    process.env.AWS_ACCESS_KEY_ID = 'AKIAIOSFODNN7EXAMPLE';
    process.env.AWS_SECRET_ACCESS_KEY = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
    process.env.AWS_MOCK_MODE = 'true';

    const client = new BedrockClient();
    expect(client.hasValidCredentials()).toBe(false);

    const agent = new AgentService();
    expect(agent.isMockMode()).toBe(true);
  });

  it('detects valid credentials when configured properly in environment', () => {
    process.env.AWS_ACCESS_KEY_ID = 'AKIAIOSFODNN7EXAMPLE';
    process.env.AWS_SECRET_ACCESS_KEY = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
    process.env.AWS_MOCK_MODE = 'false';

    const client = new BedrockClient();
    expect(client.hasValidCredentials()).toBe(true);

    const agent = new AgentService();
    expect(agent.isMockMode()).toBe(false);
  });

  it('verifies that .gitignore includes .env to prevent accidental secret check-in', () => {
    const gitignorePath = path.resolve(process.cwd(), '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
      expect(gitignoreContent).toMatch(/\.env/);
    }
  });

  it('ensures no credential patterns are leaked in agent responses or session memory', async () => {
    const testSecret = 'AKIAIOSFODNN7EXAMPLE';
    const testKey = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';

    process.env.AWS_ACCESS_KEY_ID = testSecret;
    process.env.AWS_SECRET_ACCESS_KEY = testKey;
    process.env.AWS_MOCK_MODE = 'true'; // Stay safe in mock mode

    const agent = new AgentService();
    const response = await agent.chat({
      sessionId: 'session-credential-leak-test',
      message: 'Quick dinner under $25 for two',
    });

    const responseStr = JSON.stringify(response);
    expect(responseStr).not.toContain(testSecret);
    expect(responseStr).not.toContain(testKey);

    const history = agent.getSessionHistory('session-credential-leak-test');
    const historyStr = JSON.stringify(history);
    expect(historyStr).not.toContain(testSecret);
    expect(historyStr).not.toContain(testKey);
  });
});
