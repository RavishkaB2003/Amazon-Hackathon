/**
 * Aura+ Diagnostics Fastify Routes
 * Endpoints for wire inspector, friction logger, and system diagnostics (MOD-05)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { wireRingBuffer } from '../diagnostics/ring-buffer';
import { frictionLogger } from '../diagnostics/friction-logger';
import {
  WireLogFilterSchema,
  FrictionEntrySchema,
} from '../../shared/types/diagnostics';

const RecordFrictionSchema = FrictionEntrySchema.omit({
  id: true,
  timestamp: true,
});

export function registerDiagnosticsRoutes(server: FastifyInstance): void {
  /**
   * GET /api/diagnostics/wire
   * Query in-memory wire diagnostics buffer with filtering and pagination
   */
  server.get(
    '/api/diagnostics/wire',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as Record<string, string | undefined>;

      const parsedLimit = query.limit ? parseInt(query.limit, 10) : 50;
      const parsedOffset = query.offset ? parseInt(query.offset, 10) : 0;

      const filterResult = WireLogFilterSchema.safeParse({
        direction: query.direction || 'ALL',
        type: query.type || 'ALL',
        sessionId: query.sessionId,
        method: query.method,
        status: query.status || 'ALL',
        limit: isNaN(parsedLimit) ? 50 : parsedLimit,
        offset: isNaN(parsedOffset) ? 0 : parsedOffset,
      });

      const filter = filterResult.success ? filterResult.data : {};
      const result = wireRingBuffer.query(filter);

      return reply.status(200).send(result);
    }
  );

  /**
   * DELETE /api/diagnostics/wire
   * Flushes in-memory ring buffer (idempotent)
   */
  server.delete(
    '/api/diagnostics/wire',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const result = wireRingBuffer.clear();
      return reply.status(200).send(result);
    }
  );

  /**
   * GET /api/diagnostics/friction-log
   * Returns human-readable markdown or structured JSON friction log
   */
  server.get(
    '/api/diagnostics/friction-log',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as { format?: string };
      const format = query.format?.toLowerCase() === 'json' ? 'json' : 'markdown';

      if (format === 'json') {
        reply.header('content-type', 'application/json; charset=utf-8');
        return reply.status(200).send(frictionLogger.exportJson());
      }

      reply.header('content-type', 'text/markdown; charset=utf-8');
      return reply.status(200).send(frictionLogger.exportMarkdown());
    }
  );

  /**
   * POST /api/diagnostics/friction-log/record
   * Records a developer friction observation at runtime
   */
  server.post(
    '/api/diagnostics/friction-log/record',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = RecordFrictionSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Invalid friction log entry payload',
          details: parseResult.error.issues,
        });
      }

      const recorded = frictionLogger.record(parseResult.data);
      const totalEntries = frictionLogger.getEntries().length;

      return reply.status(201).send({
        id: recorded.id,
        recorded: true,
        totalEntries,
      });
    }
  );

  /**
   * GET /api/diagnostics/summary
   * System health, wire metrics, memory consumption, and uptime
   */
  server.get(
    '/api/diagnostics/summary',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const memory = process.memoryUsage();
      const summary = {
        status: 'ok',
        wire: {
          total: wireRingBuffer.size(),
          capacity: wireRingBuffer.getCapacity(),
        },
        friction: {
          totalEntries: frictionLogger.getEntries().length,
        },
        memory: {
          rssMb: Number((memory.rss / (1024 * 1024)).toFixed(2)),
          heapUsedMb: Number((memory.heapUsed / (1024 * 1024)).toFixed(2)),
          heapTotalMb: Number((memory.heapTotal / (1024 * 1024)).toFixed(2)),
        },
        uptimeSeconds: Math.floor(process.uptime()),
        mockMode: process.env.AWS_MOCK_MODE !== 'false',
        timestamp: new Date().toISOString(),
      };

      return reply.status(200).send(summary);
    }
  );
}
