import React from 'react';
import { Volume2, User } from 'lucide-react';
import type { SpokenFeedProps } from '../types/ui';

export const SpokenFeed: React.FC<SpokenFeedProps> = ({
  spokenText,
  isStreaming,
  speaker,
  wordCount,
}) => {
  if (!spokenText && !isStreaming) {
    return null;
  }

  const computedWordCount =
    wordCount !== undefined
      ? wordCount
      : spokenText.trim().split(/\s+/).filter(Boolean).length;

  const isAura = speaker === 'aura';
  const isBrevityCompliant = computedWordCount <= 25;

  return (
    <div
      role="region"
      aria-label="Spoken assistant feed"
      className="w-full max-w-3xl mx-auto my-3 px-4"
    >
      <div
        aria-live="polite"
        aria-atomic="true"
        data-testid="spoken-feed-bubble"
        className={`p-4 rounded-xl border flex items-start gap-3 transition-colors ${
          isAura
            ? 'bg-[#1e293b] border-[#38bdf8]'
            : 'bg-[#334155] border-[#64748b]'
        }`}
      >
        {/* Speaker Avatar Icon */}
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border ${
            isAura
              ? 'bg-[#0f172a] border-[#38bdf8] text-[#38bdf8]'
              : 'bg-[#0f172a] border-[#64748b] text-[#f8fafc]'
          }`}
          aria-hidden="true"
        >
          {isAura ? <Volume2 className="w-5 h-5" /> : <User className="w-5 h-5" />}
        </div>

        {/* Content Body */}
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-caption font-semibold text-[#38bdf8]">
              {isAura ? 'Aura+ Spoken Response' : 'User Prompt'}
            </span>

            {/* Brevity Badge (FR-011) */}
            {isAura && spokenText && (
              <span
                data-testid="brevity-badge"
                className={`text-caption px-2 py-0.5 rounded-full border ${
                  isBrevityCompliant
                    ? 'bg-[#0f172a] border-[#10b981] text-[#10b981]'
                    : 'bg-[#0f172a] border-[#f59e0b] text-[#f59e0b]'
                }`}
              >
                {computedWordCount} {computedWordCount === 1 ? 'word' : 'words'}
                {isBrevityCompliant ? ' (Brief)' : ' (Extended)'}
              </span>
            )}
          </div>

          <p
            data-testid="spoken-text"
            className="text-body font-normal text-[#f8fafc] leading-relaxed"
          >
            {spokenText}
            {isStreaming && (
              <span
                data-testid="streaming-cursor"
                className="inline-block w-2 h-4 ml-1 bg-[#38bdf8] animate-pulse align-middle"
                aria-hidden="true"
              />
            )}
          </p>
        </div>
      </div>
    </div>
  );
};
