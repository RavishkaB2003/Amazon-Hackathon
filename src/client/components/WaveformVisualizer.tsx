import React, { useEffect, useRef, useState } from 'react';
import type { WaveformVisualizerProps } from '../types/ui';

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({
  state,
  audioLevel = 0.5,
  reducedMotion: propReducedMotion,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [systemReducedMotion, setSystemReducedMotion] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemReducedMotion(e.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  const isReducedMotion = propReducedMotion !== undefined ? propReducedMotion : systemReducedMotion;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let phase = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      // Clear with background color (Zero gradients - #GUARDRAIL 1)
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);

      // Reduced motion fallback: Render static, solid luminous bar (#38bdf8) with NO animation
      if (isReducedMotion) {
        ctx.fillStyle = '#38bdf8';
        const barHeight = 8;
        const barWidth = Math.max(width * 0.6, 120);
        const barX = (width - barWidth) / 2;
        ctx.fillRect(barX, centerY - barHeight / 2, barWidth, barHeight);
        return; // Terminate loop early
      }

      // Dynamic sine-wave physics based on state and audioLevel
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#38bdf8';
      ctx.beginPath();

      const baseAmplitude = state === 'speaking'
        ? (height / 3) * (audioLevel || 0.6)
        : state === 'listening'
        ? (height / 4) * (audioLevel || 0.4)
        : state === 'thinking'
        ? height / 8
        : 2; // idle baseline

      const frequency = state === 'speaking' ? 0.03 : state === 'listening' ? 0.02 : 0.01;
      const speed = state === 'speaking' ? 0.08 : state === 'listening' ? 0.05 : 0.02;

      for (let x = 0; x < width; x++) {
        // Multi-harmonic sine equation
        const y = centerY + Math.sin(x * frequency + phase) * baseAmplitude
          + Math.sin(x * frequency * 2 - phase) * (baseAmplitude * 0.4);
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();

      phase += speed;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [state, audioLevel, isReducedMotion]);

  return (
    <div
      className="w-full max-w-[640px] mx-auto py-2 px-4 flex flex-col items-center justify-center"
      data-testid="waveform-container"
    >
      <canvas
        ref={canvasRef}
        width={640}
        height={80}
        data-testid="waveform-canvas"
        data-motion={isReducedMotion ? 'reduced' : 'animated'}
        data-state={state}
        className="w-full h-[80px] rounded-md border border-[#334155] bg-[#0f172a]"
        role="img"
        aria-label={`Audio waveform visualizer: ${state} state${isReducedMotion ? ' (reduced motion mode)' : ''}`}
      />
      <div className="mt-1 text-caption text-[#94a3b8] flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${
            state === 'speaking'
              ? 'bg-[#38bdf8]'
              : state === 'listening'
              ? 'bg-[#10b981]'
              : state === 'thinking'
              ? 'bg-[#f59e0b]'
              : 'bg-[#64748b]'
          }`}
        />
        <span className="capitalize">{state}</span>
        {isReducedMotion && <span className="text-[#94a3b8]">(Static bar active)</span>}
      </div>
    </div>
  );
};
