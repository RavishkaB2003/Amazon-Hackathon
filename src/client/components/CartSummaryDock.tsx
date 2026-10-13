import React from 'react';
import { ShoppingCart, AlertCircle, RefreshCw, CheckCircle2, ShieldAlert } from 'lucide-react';
import type { CartSummaryDockProps } from '../types/ui';

export const CartSummaryDock: React.FC<CartSummaryDockProps> = ({
  itemCount,
  subtotal,
  estimatedTax,
  total,
  maxBudget,
  savingsAmount,
  version,
  onAddToCart,
  isAdding = false,
  isConflict = false,
  onResolveConflict,
}) => {
  const isOverBudget = maxBudget !== undefined && total > maxBudget;

  return (
    <div
      data-testid="cart-summary-dock"
      role="region"
      aria-label="Cart summary and order dock"
      className="fixed bottom-0 left-0 right-0 z-30 bg-[#1e293b] border-t border-[#334155] shadow-card px-4 py-3"
    >
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Concurrency Conflict Banner (OCC 409) */}
        {isConflict && (
          <div
            data-testid="cart-conflict-alert"
            role="alert"
            className="w-full sm:w-auto flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-[#0f172a] border border-[#f59e0b] text-[#f59e0b] text-caption"
          >
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-[#f59e0b] shrink-0" aria-hidden="true" />
              <span>Cart changed by concurrent action (Version {version}). Revalidating...</span>
            </div>
            {onResolveConflict && (
              <button
                type="button"
                onClick={onResolveConflict}
                className="min-h-[48px] px-3 py-1.5 rounded bg-[#1e293b] border border-[#f59e0b] text-[#f8fafc] font-semibold text-caption hover:bg-[#334155] flex items-center gap-1"
                aria-label="Resolve conflict and refresh cart"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                Refresh
              </button>
            )}
          </div>
        )}

        {/* Pricing & Breakdown Metrics */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-[#0f172a] border border-[#334155] flex items-center justify-center text-[#38bdf8]">
              <ShoppingCart className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <span className="text-caption text-[#94a3b8] block">Cart Total</span>
              <span data-testid="cart-total-amount" className="text-h1 font-bold text-[#f8fafc]">
                ${total.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="text-caption text-[#94a3b8] border-l border-[#334155] pl-4 hidden md:block">
            <div>
              Items: <strong data-testid="cart-item-count" className="text-[#f8fafc]">{itemCount}</strong>
            </div>
            <div>
              Subtotal: <span data-testid="cart-subtotal">${subtotal.toFixed(2)}</span>
              <span className="mx-1">|</span>
              Tax: <span data-testid="cart-tax">${estimatedTax.toFixed(2)}</span>
            </div>
          </div>

          {/* Budget Compliance Pill */}
          {maxBudget !== undefined && (
            <div
              data-testid="dock-budget-pill"
              className={`px-3 py-1.5 rounded-full text-caption font-semibold border flex items-center gap-1.5 ${
                isOverBudget
                  ? 'bg-[#0f172a] text-[#f59e0b] border-[#f59e0b]'
                  : 'bg-[#0f172a] text-[#10b981] border-[#10b981]'
              }`}
            >
              {isOverBudget ? (
                <>
                  <AlertCircle className="w-4 h-4 text-[#f59e0b]" aria-hidden="true" />
                  Budget Exceeded
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-[#10b981]" aria-hidden="true" />
                  Within ${maxBudget.toFixed(2)} Budget
                </>
              )}
            </div>
          )}

          {savingsAmount !== undefined && savingsAmount > 0 && (
            <span
              data-testid="dock-savings-pill"
              className="hidden lg:inline-flex px-3 py-1.5 rounded-full text-caption font-semibold bg-[#0f172a] text-[#10b981] border border-[#10b981]"
            >
              Save ${savingsAmount.toFixed(2)}
            </span>
          )}
        </div>

        {/* 1-Tap Primary Action Button (Min 48x48px hit area per NFR-009) */}
        <div className="w-full sm:w-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onAddToCart}
            disabled={isAdding}
            data-testid="btn-add-bundle-cart"
            className={`w-full sm:w-auto min-h-[52px] sm:min-h-[56px] px-8 py-3 rounded-lg font-bold text-h2 flex items-center justify-center gap-2 transition-colors focus-visible:outline-none ${
              isAdding
                ? 'bg-[#334155] text-[#94a3b8] cursor-wait'
                : 'bg-[#38bdf8] text-[#0f172a] hover:bg-[#7dd3fc] cursor-pointer'
            }`}
            aria-label="Add bundle to Amazon Fresh cart"
          >
            {isAdding ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin text-[#94a3b8]" aria-hidden="true" />
                Adding to Cart...
              </>
            ) : (
              <>
                <ShoppingCart className="w-5 h-5 text-[#0f172a]" aria-hidden="true" />
                1-Tap Add Bundle
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
