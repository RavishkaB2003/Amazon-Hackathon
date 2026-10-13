import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProtocolInspector } from '../../../src/client/components/ProtocolInspector';
import type { WireMessage } from '../../../src/client/types/ui';

describe('CHK-MOD-04-INSPECTOR: Protocol Wire Inspector Drawer & Telemetry (FR-019, OPS-002)', () => {
  const mockMessages: WireMessage[] = [
    {
      id: 'msg-01',
      timestamp: '2026-10-13T10:00:00.000Z',
      direction: 'OUTGOING',
      type: 'SSE',
      method: 'POST /agent/chat',
      payload: { sessionId: 's-1', message: 'dinner' },
      latencyMs: 120,
    },
    {
      id: 'msg-02',
      timestamp: '2026-10-13T10:00:01.000Z',
      direction: 'SSE_EVENT',
      type: 'SSE',
      method: 'widget/recipe_card',
      payload: { widgetType: 'recipe_card', title: 'Salmon Bowl' },
    },
    {
      id: 'msg-03',
      timestamp: '2026-10-13T10:00:02.000Z',
      direction: 'INCOMING',
      type: 'JSON_RPC',
      method: 'tools/call (manage_cart)',
      payload: { jsonrpc: '2.0', id: 1, result: { success: true } },
    },
    {
      id: 'msg-04',
      timestamp: '2026-10-13T10:00:03.000Z',
      direction: 'INCOMING',
      type: 'SYSTEM',
      method: 'HTTP Error',
      payload: { status: 409, error: 'Conflict' },
    },
  ];

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    messages: mockMessages,
    onClearMessages: vi.fn(),
    onExportFrictionLog: vi.fn(),
  };

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<ProtocolInspector {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders wire drawer dialog and message list when isOpen is true', () => {
    render(<ProtocolInspector {...defaultProps} />);

    expect(screen.getByTestId('protocol-inspector-drawer')).toBeDefined();
    expect(screen.getByText(/Protocol Wire Inspector/)).toBeDefined();
    expect(screen.getByTestId('wire-frame-msg-01')).toBeDefined();
    expect(screen.getByTestId('wire-frame-msg-02')).toBeDefined();
    expect(screen.getByTestId('wire-frame-msg-03')).toBeDefined();
  });

  it('filters wire frames by type (JSON_RPC, SSE, Errors)', () => {
    render(<ProtocolInspector {...defaultProps} />);

    // Click JSON-RPC filter
    const jsonRpcFilter = screen.getByRole('button', { name: /Filter JSON-RPC messages/ });
    fireEvent.click(jsonRpcFilter);

    expect(screen.queryByTestId('wire-frame-msg-01')).toBeNull();
    expect(screen.getByTestId('wire-frame-msg-03')).toBeDefined();

    // Click Errors filter
    const errorsFilter = screen.getByRole('button', { name: /Filter errors/ });
    fireEvent.click(errorsFilter);

    expect(screen.getByTestId('wire-frame-msg-04')).toBeDefined();
    expect(screen.queryByTestId('wire-frame-msg-03')).toBeNull();
  });

  it('triggers onExportFrictionLog when Export button is clicked', () => {
    const onExport = vi.fn();
    render(<ProtocolInspector {...defaultProps} onExportFrictionLog={onExport} />);

    const exportBtn = screen.getByTestId('btn-export-friction-log');
    fireEvent.click(exportBtn);

    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it('triggers onClearMessages when Clear button is clicked', () => {
    const onClear = vi.fn();
    render(<ProtocolInspector {...defaultProps} onClearMessages={onClear} />);

    const clearBtn = screen.getByTestId('btn-clear-wire-log');
    fireEvent.click(clearBtn);

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('closes drawer when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(<ProtocolInspector {...defaultProps} onClose={onClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
