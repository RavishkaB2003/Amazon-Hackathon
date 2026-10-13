import React from 'react';
import { Zap, HeartHandshake, Dumbbell } from 'lucide-react';
import type { PersonaQuickSelectProps } from '../types/ui';

interface PersonaOption {
  id: 'alex' | 'elena' | 'marcus';
  name: string;
  tagline: string;
  query: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  badgeColor: string;
}

const PERSONAS: PersonaOption[] = [
  {
    id: 'alex',
    name: 'Alex (ADHD Quick Dinner)',
    tagline: '15-min dinner for 1 under $20',
    query: 'Quick 15-minute dinner for 1 under $20',
    icon: Zap,
    badgeColor: '#38bdf8',
  },
  {
    id: 'elena',
    name: 'Elena (Family Allergies & Budget)',
    tagline: 'Family dinner for 4 under $30, dairy/peanut-free',
    query: 'Family dinner for 4 under $30, strict dairy-free and peanut-free',
    icon: HeartHandshake,
    badgeColor: '#10b981',
  },
  {
    id: 'marcus',
    name: 'Marcus (High-Protein Recovery)',
    tagline: 'Post-workout dinner >35g protein',
    query: 'High-protein post-workout dinner >35g protein',
    icon: Dumbbell,
    badgeColor: '#f59e0b',
  },
];

export const PersonaQuickSelect: React.FC<PersonaQuickSelectProps> = ({
  onSelectPersona,
  activePersona,
  disabled = false,
}) => {
  return (
    <div
      role="region"
      aria-label="Persona quick scenario triggers"
      className="w-full max-w-4xl mx-auto py-2 px-4"
    >
      <div className="flex flex-wrap items-center justify-center gap-3">
        {PERSONAS.map((p) => {
          const Icon = p.icon;
          const isSelected = activePersona === p.id;

          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelectPersona(p.id)}
              disabled={disabled}
              data-testid={`persona-btn-${p.id}`}
              className={`min-h-[48px] px-4 py-2.5 rounded-lg border flex items-center gap-3 transition-colors text-left focus-visible:outline-none ${
                isSelected
                  ? 'bg-[#334155] border-[#38bdf8] text-[#f8fafc] ring-2 ring-[#38bdf8]'
                  : 'bg-[#1e293b] border-[#334155] text-[#f8fafc] hover:bg-[#334155] hover:border-[#64748b]'
              } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
              aria-pressed={isSelected}
              aria-label={`Select persona ${p.name}: ${p.tagline}`}
            >
              <div
                className="w-8 h-8 rounded-md bg-[#0f172a] flex items-center justify-center shrink-0 border border-[#334155]"
                style={{ color: p.badgeColor }}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="flex flex-col">
                <span className="text-body font-medium leading-tight text-[#f8fafc]">
                  {p.name}
                </span>
                <span className="text-caption text-[#94a3b8] leading-tight">
                  {p.tagline}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
