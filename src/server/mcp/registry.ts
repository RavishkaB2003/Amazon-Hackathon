/**
 * In-memory Tool Registry for MCP Tools
 */

import type { McpToolRegistration } from '../../shared/types/mcp';

class ToolRegistry {
  private tools = new Map<string, McpToolRegistration>();

  registerTool(registration: McpToolRegistration): void {
    if (!registration.name || typeof registration.name !== 'string') {
      throw new Error('Tool registration requires a valid string name');
    }
    if (!registration.handler || typeof registration.handler !== 'function') {
      throw new Error(`Tool "${registration.name}" requires a valid handler function`);
    }
    this.tools.set(registration.name, {
      ...registration,
      inputSchema: registration.inputSchema || { type: 'object', properties: {} },
    });
  }

  unregisterTool(name: string): void {
    this.tools.delete(name);
  }

  getTool(name: string): McpToolRegistration | undefined {
    return this.tools.get(name);
  }

  listRegisteredTools(): McpToolRegistration[] {
    return Array.from(this.tools.values());
  }

  clearTools(): void {
    this.tools.clear();
  }
}

export const toolRegistry = new ToolRegistry();

export function registerTool(registration: McpToolRegistration): void {
  toolRegistry.registerTool(registration);
}

export function unregisterTool(name: string): void {
  toolRegistry.unregisterTool(name);
}

export function listRegisteredTools(): McpToolRegistration[] {
  return toolRegistry.listRegisteredTools();
}

export function getTool(name: string): McpToolRegistration | undefined {
  return toolRegistry.getTool(name);
}

export function clearTools(): void {
  toolRegistry.clearTools();
}
