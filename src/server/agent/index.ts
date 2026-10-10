/**
 * Aura+ MOD-03 Dual-Mode Bedrock Agent Module Barrel Export
 */

export { AgentService, agentService } from './agent';
export { registerAgentRoutes } from './routes';
export { MockEngine, mockEngine } from './mock-engine';
export { BedrockClient, bedrockClient } from './bedrock-client';
export {
  AgentMemoryStore,
  agentMemory,
  isPurgeCommand,
  MAX_SESSION_MESSAGES,
  SESSION_IDLE_TTL_MS,
} from './memory';
export {
  AURA_SYSTEM_PROMPT,
  countWords,
  trimSpokenText,
  parseAmbientConstraints,
  PERSONA_PROFILES,
  MAX_SPOKEN_WORDS_DEFAULT,
} from './prompts';
export * from '../../shared/types/agent';
