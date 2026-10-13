import React from 'react';
import { RefreshCw, ShoppingCart, Check, AlertTriangle, ShieldCheck } from 'lucide-react';
import type { BundleCarouselProps } from '../types/ui';

export const BundleCarousel: React.FC<BundleCarouselProps> = ({
  bundleId,
  recipeName,
  items,
  totalPrice,
  maxBudget,
  savingsAmount,
  onSwapItem,
  onAddToCart,
  isAddingToCart = false,
}) => {
  const isOverBudget = maxBudget !== undefined && totalPrice > maxBudget;

  return (
    <section
      data-testid="bundle-carousel-section"
      aria-label={`Ingredient bundle for ${recipeName}`}
      className="w-full my-4 py-4"
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 mb-4">
        <div>
          {/* #GUARDRAIL 2: Topmost text element */}
          <h2 className="text-h1 font-semibold text-[#f8fafc] leading-tight">
            Curated Ingredient Bundle
          </h2>
          <p className="text-caption text-[#94a3b8]">
            For: {recipeName} ({items.length} {items.length === 1 ? 'item' : 'items'})
          </p>
        </div>

        {/* Budget & Total Badges */}
        <div className="flex items-center gap-3">
          {maxBudget !== undefined && (
            <span
              data-testid="budget-status-badge"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-caption font-semibold border ${
                isOverBudget
                  ? 'bg-[#1e293b] text-[#f59e0b] border-[#f59e0b]'
                  : 'bg-[#1e293b] text-[#10b981] border-[#10b981]'
              }`}
            >
              {isOverBudget ? (
                <>
                  <AlertTriangle className="w-4 h-4 text-[#f59e0b]" aria-hidden="true" />
                  Over Budget (${totalPrice.toFixed(2)} / ${maxBudget.toFixed(2)})
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 text-[#10b981]" aria-hidden="true" />
                  Within ${maxBudget.toFixed(2)} Budget
                </>
              )}
            </span>
          )}

          {savingsAmount !== undefined && savingsAmount > 0 && (
            <span
              data-testid="savings-badge"
              className="inline-flex items-center px-3 py-1.5 rounded-full text-caption font-semibold bg-[#1e293b] text-[#10b981] border border-[#10b981]"
            >
              Saved ${savingsAmount.toFixed(2)}
            </span>
          )}

          <div className="text-right">
            <span className="text-caption text-[#94a3b8] block">Total</span>
            <span
              data-testid="bundle-total-price"
              className="text-h1 font-bold text-[#f8fafc]"
            >
              ${totalPrice.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Horizontal Swipeable Track (Peek on mobile: ~80vw / 1.2 tiles, Snap Scroll) */}
      <div
        data-testid="carousel-track"
        className="flex gap-4 overflow-x-auto pb-4 pt-1 px-4 snap-x snap-mandatory scroll-smooth focus:outline-none"
        tabIndex={0}
        role="region"
        aria-label="Ingredient carousel scroll area"
      >
        {items.map((item) => (
          <div
            key={item.sku}
            data-testid={`bundle-item-${item.sku}`}
            className="w-[280px] sm:w-[260px] md:w-[240px] shrink-0 snap-start rounded-xl border border-[#334155] bg-[#1e293b] shadow-card overflow-hidden flex flex-col transition-colors"
          >
            {/* Standalone Product Image Container (#GUARDRAIL 3) */}
            <div className="w-full h-[160px] bg-[#0f172a] overflow-hidden flex items-center justify-center border-b border-[#334155] relative">
              {item.photoUrl ? (
                <img
                  src={item.photoUrl}
                  alt={item.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="text-[#94a3b8] flex flex-col items-center justify-center p-4 text-center">
                  <ShoppingCart className="w-8 h-8 text-[#64748b] mb-1" aria-hidden="true" />
                  <span className="text-caption">Product Image</span>
                </div>
              )}
              {item.isSubstituted && (
                <span
                  data-testid="substituted-pill"
                  className="absolute top-2 right-2 px-2 py-0.5 rounded text-caption font-bold bg-[#1e293b] text-[#38bdf8] border border-[#38bdf8]"
                >
                  Swapped
                </span>
              )}
            </div>

            {/* Solid Text Panel Below (#GUARDRAIL 3 & #GUARDRAIL 4) */}
            <div className="p-4 flex flex-col flex-1 bg-[#1e293b]">
              {/* #GUARDRAIL 2: Topmost text element inside panel */}
              <h3
                data-testid={`item-title-${item.sku}`}
                className="text-h2 font-semibold text-[#f8fafc] line-clamp-2 mb-1"
                title={item.name}
              >
                {item.name}
              </h3>

              {/* Quantity / Unit below heading */}
              <p className="text-caption text-[#94a3b8] mb-2">
                {item.packageQuantity}
              </p>

              {/* Allergen Tags */}
              {item.allergenTags && item.allergenTags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {item.allergenTags.map((tag, tIdx) => (
                    <span
                      key={tIdx}
                      className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[#1e293b] text-[#10b981] border border-[#10b981]"
                    >
                      <ShieldCheck className="w-3 h-3 text-[#10b981]" aria-hidden="true" />
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Price & Swap Action Button Row */}
              <div className="mt-auto pt-3 border-t border-[#334155] flex items-center justify-between gap-2">
                <div>
                  <span className="text-h2 font-bold text-[#f8fafc]">
                    ${item.unitPrice.toFixed(2)}
                  </span>
                  <span
                    className={`block text-[11px] font-medium ${
                      item.inStock ? 'text-[#10b981]' : 'text-[#f59e0b]'
                    }`}
                  >
                    {item.inStock ? 'In Stock' : 'Out of Stock'}
                  </span>
                </div>

                {/* Swap Button (>= 48x48px hit area per NFR-009) */}
                <button
                  type="button"
                  onClick={() => onSwapItem(item.sku)}
                  data-testid={`btn-swap-${item.sku}`}
                  className="min-h-[48px] min-w-[48px] px-3 py-2 rounded-lg bg-[#1e293b] border border-[#64748b] text-[#f8fafc] hover:bg-[#334155] hover:border-[#38bdf8] hover:text-[#38bdf8] transition-colors flex items-center justify-center gap-1.5 text-caption font-medium focus-visible:outline-none"
                  aria-label={`Swap item ${item.name}`}
                >
                  <RefreshCw className="w-4 h-4" aria-hidden="true" />
                  <span>Swap</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
