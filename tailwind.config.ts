import type { Config } from 'tailwindcss';

export default {
  content: [
    './index.html',
    './src/client/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg, #0f172a)',
        surface: 'var(--color-surface, #1e293b)',
        'surface-raised': 'var(--color-surface-raised, #334155)',
        action: 'var(--color-action, #38bdf8)',
        'on-action': 'var(--color-on-action, #0f172a)',
        'action-hover': 'var(--color-action-hover, #7dd3fc)',
        text: 'var(--color-text, #f8fafc)',
        muted: 'var(--color-muted, #94a3b8)',
        border: 'var(--color-border, #334155)',
        'border-strong': 'var(--color-border-strong, #64748b)',
        accent: 'var(--color-accent, #10b981)',
        warning: 'var(--color-warning, #f59e0b)',
        focus: 'var(--color-focus, #f8fafc)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      spacing: {
        'xs': '4px',
        'sm': '8px',
        'md': '16px',
        'lg': '24px',
        'xl': '32px',
        '2xl': '48px',
      },
      borderRadius: {
        'sm': '6px',
        'md': '12px',
        'lg': '20px',
        'full': '9999px',
      },
      boxShadow: {
        'card': '0 4px 16px rgba(0, 0, 0, 0.40)',
      },
      minWidth: {
        'touch': '48px',
      },
      minHeight: {
        'touch': '48px',
      },
    },
  },
  plugins: [],
} satisfies Config;
