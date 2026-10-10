/**
 * Aura+ MOD-03 Ephemeral Conversational Memory & Session Purge Manager
 * In-memory sliding-window history (max 20 messages / 10 turns, PRIV-001).
 * RAM-only storage, zero disk persistence, instant purge with cart cleanup (PRIV-002).
 */

import type { AgentMessage, AgentSession } from '../../shared/types/agent';
import { clearCart } from '../mcp/tools';

export const MAX_SESSION_MESSAGES = 20; // 10 conversational turns (user + assistant)
export const SESSION_IDLE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Checks if a user's prompt is an explicit session purge / history reset command.
 */
export function isPurgeCommand(message: string): boolean {
  if (!message || typeof message !== 'string') return false;
  const lower = message.trim().toLowerCase();
  const purgePatterns = [
    /clear\s+(?:my\s+)?session(?:\s+history)?/i,
    /reset\s+(?:my\s+)?session(?:\s+history)?/i,
    /forget\s+everything/i,
    /clear\s+(?:my\s+)?history/i,
    /wipe\s+(?:my\s+)?session/i,
    /start\s+fresh/i,
    /reset\s+history/i,
  ];
  return purgePatterns.some((pattern) => pattern.test(lower));
}

export class AgentMemoryStore {
  // Ephemeral RAM-only store (Map) strictly partitioned by sessionId (PRIV-001)
  private sessions = new Map<string, AgentSession>();

  /**
   * Retrieves or initializes an active session for the given sessionId.
   */
  getSession(sessionId: string): AgentSession {
    if (!sessionId || typeof sessionId !== 'string') {
      throw new Error('Valid sessionId is required to retrieve session memory');
    }

    let session = this.sessions.get(sessionId);
    const now = Date.now();

    if (!session) {
      session = {
        sessionId,
        messages: [],
        createdAt: now,
        lastActivityAt: now,
      };
      this.sessions.set(sessionId, session);
    } else {
      session.lastActivityAt = now;
    }

    return session;
  }

  /**
   * Appends a message to the session's sliding-window history.
   * Prunes oldest messages if total messages exceed MAX_SESSION_MESSAGES.
   */
  addMessage(
    sessionId: string,
    message: Omit<AgentMessage, 'timestamp'> & { timestamp?: number }
  ): AgentMessage {
    const session = this.getSession(sessionId);
    const now = Date.now();

    const stampedMessage: AgentMessage = {
      role: message.role,
      content: message.content,
      timestamp: message.timestamp || now,
    };

    session.messages.push(stampedMessage);
    session.lastActivityAt = now;

    // Enforce sliding window of max 20 messages (FR-012, PRIV-001)
    if (session.messages.length > MAX_SESSION_MESSAGES) {
      session.messages = session.messages.slice(session.messages.length - MAX_SESSION_MESSAGES);
    }

    return stampedMessage;
  }

  /**
   * Returns a copy of the message history for a given session.
   */
  getSessionHistory(sessionId: string): AgentMessage[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];
    return [...session.messages];
  }

  /**
   * Instantly purges the session from volatile RAM and wipes its staged shopping cart (PRIV-002).
   */
  clearSession(sessionId: string): void {
    if (!sessionId) return;
    this.sessions.delete(sessionId);
    // Coordinate with MOD-02 cart manager to clear staged cart items
    try {
      clearCart(sessionId);
    } catch {
      // Swallowing any error if cart was already empty or non-existent
    }
  }

  /**
   * Clears all in-memory sessions across the process (testing & graceful reset).
   */
  clearAllSessions(): void {
    this.sessions.clear();
  }

  /**
   * Returns the count of currently active in-memory sessions.
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Prunes sessions that have been idle longer than the specified TTL.
   */
  cleanupExpiredSessions(maxIdleAgeMs: number = SESSION_IDLE_TTL_MS): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivityAt > maxIdleAgeMs) {
        this.clearSession(sessionId);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }
}

// Global in-memory instance
export const agentMemory = new AgentMemoryStore();
