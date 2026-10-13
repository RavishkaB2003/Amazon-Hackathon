import React from 'react';
import {
  Trash2,
  Code2,
  Monitor,
  Tablet,
  Smartphone,
  Cpu,
  Radio,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { HeaderBarProps, ViewportMode } from '../types/ui';

export const HeaderBar: React.FC<HeaderBarProps> = ({
  connectionStatus,
  isMockMode,
  activePersona,
  onClearSession,
  onToggleInspector,
  isInspectorOpen,
  viewportMode = 'echo-show-15',
  onChangeViewport,
}) => {
  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <span
            data-testid="status-connected"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-caption font-medium bg-[#1e293b] text-[#10b981] border border-[#10b981]"
          >
            <Wifi className="w-4 h-4 text-[#10b981]" aria-hidden="true" />
            Connected
          </span>
        );
      case 'reconnecting':
        return (
          <span
            data-testid="status-reconnecting"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-caption font-medium bg-[#1e293b] text-[#f59e0b] border border-[#f59e0b]"
          >
            <Radio className="w-4 h-4 text-[#f59e0b] animate-pulse" aria-hidden="true" />
            Reconnecting
          </span>
        );
      case 'offline':
      default:
        return (
          <span
            data-testid="status-offline"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-caption font-medium bg-[#1e293b] text-[#94a3b8] border border-[#64748b]"
          >
            <WifiOff className="w-4 h-4 text-[#94a3b8]" aria-hidden="true" />
            Offline
          </span>
        );
    }
  };

  return (
    <header className="w-full bg-[#1e293b] border-b border-[#334155] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
      {/* Brand & Persona */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-md bg-[#38bdf8] flex items-center justify-center font-bold text-[#0f172a] text-h2 select-none">
            A+
          </div>
          <div>
            <h1 className="text-h2 font-semibold text-[#f8fafc] leading-tight">
              Aura+
            </h1>
            <p className="text-caption text-[#94a3b8] leading-none">
              Multimodal Ambient Commerce
            </p>
          </div>
        </div>

        {activePersona && (
          <span
            data-testid="active-persona-pill"
            className="hidden sm:inline-flex items-center px-3 py-1 rounded-full text-caption font-medium bg-[#334155] text-[#f8fafc] border border-[#64748b]"
          >
            Persona: <strong className="ml-1 uppercase">{activePersona}</strong>
          </span>
        )}
      </div>

      {/* Viewport Switcher Controls */}
      {onChangeViewport && (
        <div
          role="toolbar"
          aria-label="Viewport controls"
          className="flex items-center bg-[#0f172a] p-1 rounded-md border border-[#334155]"
        >
          <button
            type="button"
            onClick={() => onChangeViewport('echo-show-15')}
            className={`min-h-[48px] min-w-[48px] px-3 py-2 rounded flex items-center gap-1.5 text-caption font-medium transition-colors ${
              viewportMode === 'echo-show-15'
                ? 'bg-[#38bdf8] text-[#0f172a] font-semibold'
                : 'text-[#94a3b8] hover:text-[#f8fafc] hover:bg-[#1e293b]'
            }`}
            aria-pressed={viewportMode === 'echo-show-15'}
            aria-label="Echo Show 15 Landscape (1920x1080)"
          >
            <Monitor className="w-4 h-4" aria-hidden="true" />
            <span className="hidden md:inline">Show 15</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeViewport('echo-show-8')}
            className={`min-h-[48px] min-w-[48px] px-3 py-2 rounded flex items-center gap-1.5 text-caption font-medium transition-colors ${
              viewportMode === 'echo-show-8'
                ? 'bg-[#38bdf8] text-[#0f172a] font-semibold'
                : 'text-[#94a3b8] hover:text-[#f8fafc] hover:bg-[#1e293b]'
            }`}
            aria-pressed={viewportMode === 'echo-show-8'}
            aria-label="Echo Show 8 Tablet (1280x800)"
          >
            <Tablet className="w-4 h-4" aria-hidden="true" />
            <span className="hidden md:inline">Show 8</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeViewport('mobile')}
            className={`min-h-[48px] min-w-[48px] px-3 py-2 rounded flex items-center gap-1.5 text-caption font-medium transition-colors ${
              viewportMode === 'mobile'
                ? 'bg-[#38bdf8] text-[#0f172a] font-semibold'
                : 'text-[#94a3b8] hover:text-[#f8fafc] hover:bg-[#1e293b]'
            }`}
            aria-pressed={viewportMode === 'mobile'}
            aria-label="Mobile Preview (393x852)"
          >
            <Smartphone className="w-4 h-4" aria-hidden="true" />
            <span className="hidden md:inline">Phone</span>
          </button>
        </div>
      )}

      {/* System Status & Actions */}
      <div className="flex items-center gap-2">
        {/* Mock Mode Pill */}
        <span
          data-testid="mock-mode-pill"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-caption font-medium bg-[#1e293b] text-[#38bdf8] border border-[#38bdf8]"
        >
          <Cpu className="w-3.5 h-3.5 text-[#38bdf8]" aria-hidden="true" />
          {isMockMode ? 'Mock Engine' : 'Live Bedrock'}
        </span>

        {/* Connection Status */}
        {getStatusBadge()}

        {/* Inspector Wire Toggle */}
        <button
          type="button"
          onClick={onToggleInspector}
          className={`min-h-[48px] min-w-[48px] px-3 py-2 rounded-md border flex items-center gap-1.5 text-caption font-medium transition-colors ${
            isInspectorOpen
              ? 'bg-[#334155] border-[#f8fafc] text-[#f8fafc]'
              : 'bg-[#1e293b] border-[#64748b] text-[#94a3b8] hover:text-[#f8fafc] hover:bg-[#334155]'
          }`}
          aria-pressed={isInspectorOpen}
          aria-label="Toggle Protocol Inspector Wire Drawer"
          data-testid="btn-toggle-inspector"
        >
          <Code2 className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">Wire</span>
        </button>

        {/* 1-Tap Clear Session Button (PRIV-002) */}
        <button
          type="button"
          onClick={onClearSession}
          className="min-h-[48px] min-w-[48px] px-3 py-2 rounded-md bg-[#1e293b] border border-[#64748b] text-[#f8fafc] hover:bg-[#334155] hover:border-[#f59e0b] hover:text-[#f59e0b] transition-colors flex items-center gap-1.5 text-caption font-medium focus-visible:outline-none"
          aria-label="Clear session memory and cart"
          data-testid="btn-clear-session"
        >
          <Trash2 className="w-4 h-4 text-[#f59e0b]" aria-hidden="true" />
          <span className="hidden sm:inline">Clear Session</span>
        </button>
      </div>
    </header>
  );
};
