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
  showDebug = false,
}) => {
  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <span
            data-testid="status-connected"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-caption font-medium bg-[#111a2e] text-[#10b981] border border-[#10b981]/40"
          >
            <Wifi className="w-4 h-4 text-[#10b981]" aria-hidden="true" />
            Connected
          </span>
        );
      case 'reconnecting':
        return (
          <span
            data-testid="status-reconnecting"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-caption font-medium bg-[#111a2e] text-[#f59e0b] border border-[#f59e0b]/40"
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-caption font-medium bg-[#111a2e] text-[#94a3b8] border border-[#334b75]"
          >
            <WifiOff className="w-4 h-4 text-[#94a3b8]" aria-hidden="true" />
            Offline
          </span>
        );
    }
  };

  return (
    <header className="w-full bg-[#111a2e] border-b border-[#1e2d4a] px-6 py-4 flex flex-wrap items-center justify-between gap-4 select-none">
      {/* Brand */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#38bdf8] flex items-center justify-center font-bold text-[#080c14] text-xl select-none shadow-md">
            A+
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#f8fafc] leading-tight tracking-tight">
              Aura+
            </h1>
            <p className="text-xs text-[#94a3b8] leading-none mt-0.5">
              Ambient Nutrition & Cooking Concierge
            </p>
          </div>
        </div>

        {/* Debug: Active Persona */}
        {showDebug && activePersona && (
          <span
            data-testid="active-persona-pill"
            className="hidden sm:inline-flex items-center px-3 py-1 rounded-full text-caption font-medium bg-[#1a263e] text-[#f8fafc] border border-[#334b75]"
          >
            Persona: <strong className="ml-1 uppercase">{activePersona}</strong>
          </span>
        )}
      </div>

      {/* Debug: Viewport Switcher Controls */}
      {showDebug && onChangeViewport && (
        <div
          role="toolbar"
          aria-label="Viewport controls"
          className="flex items-center bg-[#080c14] p-1 rounded-xl border border-[#1e2d4a]"
        >
          <button
            type="button"
            onClick={() => onChangeViewport('echo-show-15')}
            className={`min-h-[48px] min-w-[48px] px-3 py-2 rounded-lg flex items-center gap-1.5 text-caption font-medium transition-colors ${
              viewportMode === 'echo-show-15'
                ? 'bg-[#38bdf8] text-[#080c14] font-semibold'
                : 'text-[#94a3b8] hover:text-[#f8fafc] hover:bg-[#111a2e]'
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
            className={`min-h-[48px] min-w-[48px] px-3 py-2 rounded-lg flex items-center gap-1.5 text-caption font-medium transition-colors ${
              viewportMode === 'echo-show-8'
                ? 'bg-[#38bdf8] text-[#080c14] font-semibold'
                : 'text-[#94a3b8] hover:text-[#f8fafc] hover:bg-[#111a2e]'
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
            className={`min-h-[48px] min-w-[48px] px-3 py-2 rounded-lg flex items-center gap-1.5 text-caption font-medium transition-colors ${
              viewportMode === 'mobile'
                ? 'bg-[#38bdf8] text-[#080c14] font-semibold'
                : 'text-[#94a3b8] hover:text-[#f8fafc] hover:bg-[#111a2e]'
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
      <div className="flex items-center gap-3">
        {/* Debug: Mock Mode Pill */}
        {showDebug && (
          <span
            data-testid="mock-mode-pill"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-caption font-medium bg-[#111a2e] text-[#38bdf8] border border-[#38bdf8]/40"
          >
            <Cpu className="w-3.5 h-3.5 text-[#38bdf8]" aria-hidden="true" />
            {isMockMode ? 'Mock Engine' : 'Live Bedrock'}
          </span>
        )}

        {/* Connection Status Badge */}
        {getStatusBadge()}

        {/* Debug: Inspector Wire Toggle */}
        {showDebug && (
          <button
            type="button"
            onClick={onToggleInspector}
            className={`min-h-[48px] min-w-[48px] px-3 py-2 rounded-xl border flex items-center gap-1.5 text-caption font-medium transition-colors ${
              isInspectorOpen
                ? 'bg-[#1a263e] border-[#f8fafc] text-[#f8fafc]'
                : 'bg-[#111a2e] border-[#334b75] text-[#94a3b8] hover:text-[#f8fafc] hover:bg-[#1a263e]'
            }`}
            aria-pressed={isInspectorOpen}
            aria-label="Toggle Protocol Inspector Wire Drawer"
            data-testid="btn-toggle-inspector"
          >
            <Code2 className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Wire</span>
          </button>
        )}

        {/* 1-Tap Clear Session Button (PRIV-002) */}
        <button
          type="button"
          onClick={onClearSession}
          className="min-h-[48px] min-w-[48px] px-3 py-2 rounded-xl bg-[#111a2e] border border-[#334b75] text-[#f8fafc] hover:bg-[#1a263e] hover:border-[#f59e0b] hover:text-[#f59e0b] transition-colors flex items-center gap-1.5 text-caption font-medium focus-visible:outline-none"
          aria-label="Clear session memory and cart"
          data-testid="btn-clear-session"
        >
          <Trash2 className="w-4 h-4 text-[#f59e0b]" aria-hidden="true" />
          <span className="hidden sm:inline">Clear</span>
        </button>
      </div>
    </header>
  );
};
