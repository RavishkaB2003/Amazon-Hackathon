import React, { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { ConfirmModalProps } from '../types/ui';

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      data-testid="confirm-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0f172a]/70"
    >
      <div
        data-testid="confirm-modal-card"
        className="w-full max-w-md bg-[#1e293b] border border-[#64748b] rounded-xl shadow-card p-6 flex flex-col gap-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#0f172a] border border-[#f59e0b] flex items-center justify-center text-[#f59e0b] shrink-0">
            <AlertTriangle className="w-5 h-5" aria-hidden="true" />
          </div>
          <h2
            id="confirm-modal-title"
            data-testid="confirm-modal-title"
            className="text-h1 font-semibold text-[#f8fafc]"
          >
            {title}
          </h2>
        </div>

        <p className="text-body text-[#94a3b8] leading-relaxed">
          {message}
        </p>

        <div className="flex items-center justify-end gap-3 mt-2">
          <button
            type="button"
            onClick={onCancel}
            data-testid="btn-modal-cancel"
            className="min-h-[48px] px-4 py-2 rounded-lg border border-[#64748b] bg-[#1e293b] text-[#f8fafc] hover:bg-[#334155] font-medium text-body transition-colors focus-visible:outline-none"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            data-testid="btn-modal-confirm"
            className="min-h-[48px] px-4 py-2 rounded-lg bg-[#38bdf8] text-[#0f172a] hover:bg-[#7dd3fc] font-bold text-body transition-colors focus-visible:outline-none"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
