/**
 * Aura+ MOD-05 Diagnostics & Friction Logger Contracts
 * TypeScript interfaces and Zod validation schemas
 */

import { z } from 'zod';

// ============================================================================
// Wire Inspector Types & Schemas (FR-019, OPS-002)
// ============================================================================

export const WireDirectionSchema = z.enum(['INCOMING', 'OUTGOING', 'SSE_EVENT']);
export type WireDirection = z.infer<typeof WireDirectionSchema>;

export const WireMessageTypeSchema = z.enum(['JSON_RPC', 'SSE', 'SYSTEM', 'HTTP']);
export type WireMessageType = z.infer<typeof WireMessageTypeSchema>;

export const WireLogEntrySchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  timestampNs: z.union([z.bigint(), z.string(), z.number()]).optional(),
  direction: WireDirectionSchema,
  type: WireMessageTypeSchema,
  method: z.string().optional(),
  sessionId: z.string().optional(),
  statusCode: z.number().optional(),
  durationMs: z.number().optional(),
  payloadBytes: z.number().nonnegative().optional().default(0),
  payload: z.unknown(),
  error: z
    .object({
      code: z.number(),
      message: z.string(),
      data: z.unknown().optional(),
    })
    .optional(),
  latencyMs: z.number().optional(),
});

export type WireLogEntry = z.infer<typeof WireLogEntrySchema>;
export type WireMessage = WireLogEntry;

export const WireLogFilterSchema = z.object({
  direction: z.union([WireDirectionSchema, z.literal('ALL')]).optional().default('ALL'),
  type: z.union([WireMessageTypeSchema, z.literal('ALL')]).optional().default('ALL'),
  sessionId: z.string().optional(),
  method: z.string().optional(),
  status: z.enum(['ALL', 'SUCCESS', 'ERROR']).optional().default('ALL'),
  limit: z.number().int().min(1).max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

export interface WireLogFilter {
  direction?: WireDirection | 'ALL';
  type?: WireMessageType | 'ALL';
  sessionId?: string;
  method?: string;
  status?: 'ALL' | 'SUCCESS' | 'ERROR';
  limit?: number;
  offset?: number;
}
export type WireFilter = WireLogFilter;

export const WireLogResponseSchema = z.object({
  total: z.number().int().nonnegative(),
  filtered: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  entries: z.array(WireLogEntrySchema),
});

export type WireLogResponse = z.infer<typeof WireLogResponseSchema>;
export type WireSummary = WireLogResponse;

// ============================================================================
// Friction Logger Types & Schemas (FR-020, PRIV-003)
// ============================================================================

export const FrictionCategorySchema = z.enum([
  'MCP_SDK',
  'BEDROCK_CONVERSE',
  'FASTIFY_SSE',
  'REACT_19',
  'POWERSHELL_WINDOWS',
]);
export type FrictionCategory = z.infer<typeof FrictionCategorySchema>;

export const FrictionSeveritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export type FrictionSeverity = z.infer<typeof FrictionSeveritySchema>;

export const FrictionEntrySchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  category: FrictionCategorySchema,
  severity: FrictionSeveritySchema,
  title: z.string().max(100),
  description: z.string().max(4000),
  workaroundOrFix: z.string().max(4000),
  sdkVersion: z.string().optional(),
  impactMinutes: z.number().int().nonnegative().optional(),
  reproducible: z.boolean(),
});

export type FrictionEntry = z.infer<typeof FrictionEntrySchema>;
export type FrictionLogEntry = FrictionEntry;

export const FrictionLogExportSchema = z.object({
  generatedAt: z.string(),
  project: z.string(),
  totalEntries: z.number().int().nonnegative(),
  entriesByCategory: z.record(FrictionCategorySchema, z.number().int().nonnegative()),
  markdown: z.string(),
  entries: z.array(FrictionEntrySchema),
});

export type FrictionLogExport = z.infer<typeof FrictionLogExportSchema>;
export type FrictionReport = FrictionLogExport;

// ============================================================================
// Benchmark & Demonstration Types (OPS-001, OPS-003)
// ============================================================================

export const BenchmarkMetricsSchema = z.object({
  scenarioName: z.string(),
  personaId: z.enum(['alex', 'elena', 'marcus']),
  turnsCount: z.number().int().positive(),
  ttftMs: z.number().nonnegative(),
  totalDurationMs: z.number().nonnegative(),
  wireOverheadBytes: z.number().int().nonnegative(),
  toolExecutionDurationMs: z.number().nonnegative(),
  occConflictHandled: z.boolean(),
  peakRssMemoryMb: z.number().nonnegative(),
  status: z.enum(['PASS', 'FAIL']),
});

export type BenchmarkMetrics = z.infer<typeof BenchmarkMetricsSchema>;
export type BenchmarkScenarioResult = BenchmarkMetrics;

export const BenchmarkSummarySchema = z.object({
  runId: z.string(),
  timestamp: z.string(),
  mockMode: z.boolean(),
  totalScenarios: z.number().int().nonnegative(),
  passedScenarios: z.number().int().nonnegative(),
  failedScenarios: z.number().int().nonnegative(),
  averageTtftMs: z.number().nonnegative(),
  averageDurationMs: z.number().nonnegative(),
  maxRssMemoryMb: z.number().nonnegative(),
  scenarios: z.array(BenchmarkMetricsSchema),
});

export type BenchmarkSummary = z.infer<typeof BenchmarkSummarySchema>;

// ============================================================================
// PII Scrubber Options (SEC-001, PRIV-001, PRIV-003)
// ============================================================================

export const PiiScrubberOptionsSchema = z.object({
  maskCard: z.boolean().optional().default(true),
  maskUuid: z.boolean().optional().default(true),
  maskKeywords: z.boolean().optional().default(true),
  maskSecrets: z.boolean().optional().default(true),
});

export type PiiScrubberOptions = z.infer<typeof PiiScrubberOptionsSchema>;
