import React, { useState, useEffect } from 'react';
import {
  Code2,
  X,
  Trash2,
  Download,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  Radio,
  Copy,
  Check,
} from 'lucide-react';
import type { ProtocolInspectorProps, WireMessage } from '../types/ui';

export const ProtocolInspector: React.FC<ProtocolInspectorProps> = ({
  isOpen,
  onClose,
  messages,
  onClearMessages,
  onExportFrictionLog,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'JSON_RPC' | 'SSE' | 'ERRORS'>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const filteredMessages = messages.filter((m) => {
    if (filter === 'ALL') return true;
    if (filter === 'JSON_RPC') return m.type === 'JSON_RPC';
    if (filter === 'SSE') return m.type === 'SSE' || m.direction === 'SSE_EVENT';
    if (filter === 'ERRORS') {
      const str = JSON.stringify(m.payload).toLowerCase();
      return str.includes('error') || str.includes('fail') || m.type === 'SYSTEM';
    }
    return true;
  });

  const handleCopyPayload = (id: string, payload: unknown) => {
    try {
      navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore clipboard error
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-label="Protocol Inspector Wire Drawer"
      aria-modal="true"
      data-testid="protocol-inspector-drawer"
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#1e293b] border-t-2 border-[#38bdf8] shadow-2xl flex flex-col h-[420px] max-h-[85vh] transition-all duration-200"
    >
      {/* Header Bar */}
      <div className="bg-[#0f172a] px-4 py-3 flex items-center justify-between border-b border-[#334155]">
        <div className="flex items-center gap-3">
          <Code2 className="w-5 h-5 text-[#38bdf8]" aria-hidden="true" />
          <h2 className="text-h2 font-semibold text-[#f8fafc] leading-none">
            Protocol Wire Inspector (JSON-RPC 2.0 & SSE)
          </h2>
          <span className="text-caption text-[#94a3b8] bg-[#1e293b] px-2.5 py-0.5 rounded-full border border-[#334155]">
            {filteredMessages.length} / {messages.length} frames
          </span>
        </div>

        {/* Filter Chips & Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Filter Toolbar */}
          <div
            role="toolbar"
            aria-label="Message filters"
            className="hidden sm:flex items-center bg-[#1e293b] p-1 rounded-md border border-[#334155]"
          >
            <button
              type="button"
              onClick={() => setFilter('ALL')}
              className={`min-h-[48px] px-3 py-1 rounded text-caption font-medium transition-colors ${
                filter === 'ALL'
                  ? 'bg-[#38bdf8] text-[#0f172a]'
                  : 'text-[#94a3b8] hover:text-[#f8fafc]'
              }`}
              aria-label="Filter all messages"
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilter('JSON_RPC')}
              className={`min-h-[48px] px-3 py-1 rounded text-caption font-medium transition-colors ${
                filter === 'JSON_RPC'
                  ? 'bg-[#38bdf8] text-[#0f172a]'
                  : 'text-[#94a3b8] hover:text-[#f8fafc]'
              }`}
              aria-label="Filter JSON-RPC messages"
            >
              JSON-RPC
            </button>
            <button
              type="button"
              onClick={() => setFilter('SSE')}
              className={`min-h-[48px] px-3 py-1 rounded text-caption font-medium transition-colors ${
                filter === 'SSE'
                  ? 'bg-[#38bdf8] text-[#0f172a]'
                  : 'text-[#94a3b8] hover:text-[#f8fafc]'
              }`}
              aria-label="Filter SSE events"
            >
              SSE
            </button>
            <button
              type="button"
              onClick={() => setFilter('ERRORS')}
              className={`min-h-[48px] px-3 py-1 rounded text-caption font-medium transition-colors ${
                filter === 'ERRORS'
                  ? 'bg-[#f59e0b] text-[#0f172a]'
                  : 'text-[#94a3b8] hover:text-[#f8fafc]'
              }`}
              aria-label="Filter errors"
            >
              Errors
            </button>
          </div>

          {/* Export Friction Log */}
          <button
            type="button"
            onClick={onExportFrictionLog}
            data-testid="btn-export-friction-log"
            className="min-h-[48px] min-w-[48px] px-3 py-2 rounded-md bg-[#1e293b] border border-[#64748b] text-[#f8fafc] hover:bg-[#334155] hover:border-[#38bdf8] flex items-center gap-1.5 text-caption font-medium transition-colors focus-visible:outline-none"
            aria-label="Export FRICTION_LOG.md"
          >
            <Download className="w-4 h-4 text-[#38bdf8]" aria-hidden="true" />
            <span className="hidden md:inline">Export Friction Log</span>
          </button>

          {/* Clear Wire Log */}
          <button
            type="button"
            onClick={onClearMessages}
            data-testid="btn-clear-wire-log"
            className="min-h-[48px] min-w-[48px] px-3 py-2 rounded-md bg-[#1e293b] border border-[#64748b] text-[#94a3b8] hover:text-[#f8fafc] hover:bg-[#334155] flex items-center gap-1.5 text-caption font-medium transition-colors focus-visible:outline-none"
            aria-label="Clear wire messages"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
            <span className="hidden md:inline">Clear</span>
          </button>

          {/* Close Drawer Button */}
          <button
            type="button"
            onClick={onClose}
            data-testid="btn-close-inspector"
            className="min-h-[48px] min-w-[48px] px-3 py-2 rounded-md bg-[#1e293b] border border-[#64748b] text-[#f8fafc] hover:bg-[#334155] flex items-center justify-center transition-colors focus-visible:outline-none"
            aria-label="Close protocol wire drawer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Messages Scroll View */}
      <div
        data-testid="inspector-message-list"
        className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-[13px] bg-[#0f172a]"
        tabIndex={0}
      >
        {filteredMessages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[#94a3b8]">
            No wire frames recorded yet. Send a prompt or trigger a scenario to inspect traffic.
          </div>
        ) : (
          filteredMessages.map((m) => (
            <div
              key={m.id}
              data-testid={`wire-frame-${m.id}`}
              className="p-3 rounded-lg bg-[#1e293b] border border-[#334155] flex flex-col gap-2 hover:border-[#64748b] transition-colors"
            >
              {/* Row Header */}
              <div className="flex items-center justify-between text-caption border-b border-[#334155] pb-2">
                <div className="flex items-center gap-2">
                  {/* Direction Badge */}
                  {m.direction === 'OUTGOING' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-[#0f172a] text-[#10b981] border border-[#10b981]">
                      <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
                      OUT
                    </span>
                  )}
                  {m.direction === 'INCOMING' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-[#0f172a] text-[#38bdf8] border border-[#38bdf8]">
                      <ArrowDownLeft className="w-3 h-3" aria-hidden="true" />
                      IN
                    </span>
                  )}
                  {m.direction === 'SSE_EVENT' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-[#0f172a] text-[#f59e0b] border border-[#f59e0b]">
                      <Radio className="w-3 h-3" aria-hidden="true" />
                      SSE
                    </span>
                  )}

                  <span className="text-[#f8fafc] font-semibold">
                    {m.method || m.type}
                  </span>
                  {m.latencyMs !== undefined && (
                    <span className="text-[#94a3b8] text-[11px]">
                      +{m.latencyMs}ms
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[#94a3b8] text-[11px]">
                    {new Date(m.timestamp).toLocaleTimeString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyPayload(m.id, m.payload)}
                    className="min-h-[48px] min-w-[48px] px-2 py-1 rounded bg-[#0f172a] border border-[#334155] text-[#94a3b8] hover:text-[#f8fafc] flex items-center justify-center transition-colors focus-visible:outline-none"
                    aria-label="Copy JSON payload"
                  >
                    {copiedId === m.id ? (
                      <Check className="w-3.5 h-3.5 text-[#10b981]" aria-hidden="true" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              {/* JSON Payload Monospace View */}
              <pre className="text-[#f8fafc] overflow-x-auto whitespace-pre-wrap break-all text-[12px] bg-[#0f172a] p-2.5 rounded border border-[#334155]">
                {JSON.stringify(m.payload, null, 2)}
              </pre>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
