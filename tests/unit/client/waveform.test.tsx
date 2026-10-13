import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WaveformVisualizer } from '../../../src/client/components/WaveformVisualizer';

describe('CHK-MOD-04-WAVEFORM: Audio Waveform Visualizer & Motion Fallback (FR-016, NFR-010)', () => {
  let mockCtx: {
    fillStyle: string;
    strokeStyle: string;
    lineWidth: number;
    fillRect: ReturnType<typeof vi.fn>;
    beginPath: ReturnType<typeof vi.fn>;
    moveTo: ReturnType<typeof vi.fn>;
    lineTo: ReturnType<typeof vi.fn>;
    stroke: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockCtx = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
    };

    HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation((contextId) => {
      if (contextId === '2d') {
        return mockCtx;
      }
      return null;
    });
  });

  it('initializes HTML5 canvas and renders accessible role and label', () => {
    render(<WaveformVisualizer state="listening" audioLevel={0.5} />);

    const canvas = screen.getByTestId('waveform-canvas');
    expect(canvas).toBeDefined();
    expect(canvas.getAttribute('role')).toBe('img');
    expect(canvas.getAttribute('aria-label')).toContain('listening state');
    expect(canvas.getAttribute('data-state')).toBe('listening');
    expect(canvas.getAttribute('data-motion')).toBe('animated');
  });

  it('animates sine wave on canvas during speaking state', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame');

    render(<WaveformVisualizer state="speaking" audioLevel={0.8} />);

    expect(mockCtx.beginPath).toHaveBeenCalled();
    expect(mockCtx.stroke).toHaveBeenCalled();
    expect(mockCtx.strokeStyle).toBe('#38bdf8');
    expect(rafSpy).toHaveBeenCalled();

    rafSpy.mockRestore();
  });

  it('switches to static solid luminous bar (#38bdf8) when reducedMotion is true', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame');

    render(<WaveformVisualizer state="speaking" audioLevel={0.8} reducedMotion={true} />);

    const canvas = screen.getByTestId('waveform-canvas');
    expect(canvas.getAttribute('data-motion')).toBe('reduced');
    expect(canvas.getAttribute('aria-label')).toContain('reduced motion mode');

    // In reduced motion, stroke/sine wave should NOT be drawn; static fillRect should be called with #38bdf8
    expect(mockCtx.fillStyle).toBe('#38bdf8');
    expect(mockCtx.fillRect).toHaveBeenCalled();
    // Continuous animation loop requestAnimationFrame should NOT be called in reduced motion mode
    expect(rafSpy).not.toHaveBeenCalled();

    rafSpy.mockRestore();
  });

  it('displays correct state text in indicator', () => {
    const { rerender } = render(<WaveformVisualizer state="idle" />);
    expect(screen.getByText(/idle/i)).toBeDefined();

    rerender(<WaveformVisualizer state="thinking" />);
    expect(screen.getByText(/thinking/i)).toBeDefined();
  });
});
