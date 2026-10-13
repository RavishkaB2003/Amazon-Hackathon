import React, { useState, useEffect } from 'react';
import { Mic, ArrowRight, Sparkles } from 'lucide-react';

export interface AmbientHomeViewProps {
  onSearch: (prompt: string) => void;
  disabled?: boolean;
}

export const AmbientHomeView: React.FC<AmbientHomeViewProps> = ({
  onSearch,
  disabled = false,
}) => {
  const [time, setTime] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [greeting, setGreeting] = useState<string>('Good evening');
  const [inputValue, setInputValue] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
      );
      setDate(
        now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
      );

      const hour = now.getHours();
      if (hour < 12) {
        setGreeting('Good morning');
      } else if (hour < 17) {
        setGreeting('Good afternoon');
      } else {
        setGreeting('Good evening');
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !disabled) {
      onSearch(inputValue.trim());
      setInputValue('');
    }
  };

  const starterPrompts = [
    {
      label: 'Quick $20 Dinner in 15m',
      prompt: 'Quick 15-minute high dopamine dinner for 1 under $20',
    },
    {
      label: 'Family Dinner Under $30',
      prompt: 'Family dinner for 4 under $30, strict dairy-free and peanut-free',
    },
    {
      label: 'High-Protein (>35g)',
      prompt: 'High-protein post-workout dinner >35g protein',
    },
  ];

  return (
    <div
      data-testid="ambient-home-view"
      className="flex flex-col items-center justify-center flex-1 max-w-4xl mx-auto w-full px-4 py-8 text-center"
    >
      {/* Ambient Clock & Date (10-foot UI) */}
      <div className="mb-8 select-none">
        <h2
          data-testid="ambient-clock"
          className="text-6xl sm:text-7xl md:text-8xl font-bold tracking-tight text-[#f8fafc] font-sans"
        >
          {time || '10:42 AM'}
        </h2>
        <p
          data-testid="ambient-date"
          className="text-lg sm:text-xl font-medium text-[#94a3b8] mt-2"
        >
          {date || 'Tuesday, October 13'}
        </p>
      </div>

      {/* Contextual Greeting */}
      <div className="mb-10 max-w-xl">
        <p className="text-xl sm:text-2xl font-semibold text-[#f8fafc] leading-snug">
          {greeting}. What would you like to prepare for dinner?
        </p>
        <p className="text-sm text-[#94a3b8] mt-2">
          Ask Aura anything, set a budget, or choose dietary requirements.
        </p>
      </div>

      {/* Distraction-Free Natural Input Bar */}
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl relative mb-8"
      >
        <div className="relative flex items-center">
          <input
            type="text"
            data-testid="ambient-input-box"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={disabled}
            placeholder="Ask Aura anything or describe what you want to cook..."
            className="w-full h-16 pl-6 pr-28 rounded-2xl bg-[#111a2e] border-2 border-[#1e2d4a] text-[#f8fafc] placeholder-[#94a3b8] text-base sm:text-lg focus:outline-none focus:border-[#38bdf8] focus:ring-4 focus:ring-[#38bdf8]/20 transition-all shadow-xl"
            aria-label="Ask Aura or describe meal intent"
          />
          <div className="absolute right-2 flex items-center gap-1">
            <button
              type="button"
              onClick={() => onSearch('Plan a healthy family dinner under $30')}
              disabled={disabled}
              className="min-h-[48px] min-w-[48px] p-2.5 rounded-xl text-[#38bdf8] hover:bg-[#1a263e] transition-colors flex items-center justify-center"
              aria-label="Simulate voice listening"
              title="Voice Input"
            >
              <Mic className="w-6 h-6" aria-hidden="true" />
            </button>
            <button
              type="submit"
              disabled={disabled || !inputValue.trim()}
              className="min-h-[48px] min-w-[48px] p-2.5 rounded-xl bg-[#38bdf8] text-[#080c14] hover:bg-[#7dd3fc] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center font-bold"
              aria-label="Send meal request"
            >
              <ArrowRight className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </form>

      {/* Low-Friction Starter Prompt Chips */}
      <div className="flex flex-wrap items-center justify-center gap-3 max-w-2xl">
        {starterPrompts.map((item, idx) => (
          <button
            key={idx}
            type="button"
            data-testid={`starter-prompt-${idx}`}
            onClick={() => onSearch(item.prompt)}
            disabled={disabled}
            className="min-h-[48px] px-5 py-3 rounded-full bg-[#111a2e] border border-[#1e2d4a] hover:border-[#38bdf8] hover:bg-[#1a263e] text-[#f8fafc] text-sm font-medium transition-all flex items-center gap-2 shadow-md active:scale-95"
          >
            <Sparkles className="w-4 h-4 text-[#38bdf8]" aria-hidden="true" />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
