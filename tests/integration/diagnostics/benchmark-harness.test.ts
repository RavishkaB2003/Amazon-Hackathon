/**
 * Integration Test Suite: Benchmark Harness & Demo Runner (OPS-001, OPS-003, NFR-001, NFR-004)
 * Tests multi-turn synthetic benchmark execution, OCC 409 recovery, and demo runner
 */

import { describe, it, expect } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';
import { runBenchmarks } from '../../../scripts/benchmark-scenarios';
import { runDemoPersonas } from '../../../scripts/demo-personas';

describe('CHK-MOD-05-BENCHMARK & CHK-MOD-05-DEMO: Synthetic Harness & Scenarios', () => {
  it('executes synthetic multi-turn benchmarks for Alex, Elena, Marcus meeting all NFR latency & memory targets', async () => {
    const tempReportPath = path.resolve(process.cwd(), 'artifacts/test-benchmark-report.json');

    const summary = await runBenchmarks({
      silent: true,
      artifactPath: tempReportPath,
    });

    expect(summary.totalScenarios).toBe(3);
    expect(summary.passedScenarios).toBe(3);
    expect(summary.failedScenarios).toBe(0);

    // NFR-001: TTFT target < 1200ms in mock mode
    expect(summary.averageTtftMs).toBeLessThan(1200);

    // NFR-004: Memory RSS ceiling < 150MB
    expect(summary.maxRssMemoryMb).toBeLessThan(150);

    // Verify Marcus OCC 409 reconciliation
    const marcusScenario = summary.scenarios.find((s) => s.personaId === 'marcus');
    expect(marcusScenario).toBeDefined();
    expect(marcusScenario?.occConflictHandled).toBe(true);
    expect(marcusScenario?.status).toBe('PASS');

    // Verify written JSON artifact
    const reportData = await fs.readFile(tempReportPath, 'utf8');
    const parsed = JSON.parse(reportData);
    expect(parsed.totalScenarios).toBe(3);
    expect(parsed.passedScenarios).toBe(3);

    // Cleanup temp artifact
    await fs.unlink(tempReportPath).catch(() => {});
  }, 30000);

  it('executes persona demonstration flow deterministically within sub-3 minute runtime (OPS-003)', async () => {
    const result = await runDemoPersonas({
      silent: true,
      interactiveDelayMs: 5,
    });

    expect(result.alexSuccess).toBe(true);
    expect(result.elenaSuccess).toBe(true);
    expect(result.marcusSuccess).toBe(true);

    // OPS-003: Sub-3 minute (180,000 ms) window
    expect(result.totalDurationMs).toBeLessThan(180000);
  }, 30000);
});
