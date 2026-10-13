import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeaderBar } from '../../../src/client/components/HeaderBar';
import { PersonaQuickSelect } from '../../../src/client/components/PersonaQuickSelect';
import { RecipeCard } from '../../../src/client/components/RecipeCard';
import { BundleCarousel } from '../../../src/client/components/BundleCarousel';
import { CartSummaryDock } from '../../../src/client/components/CartSummaryDock';
import { ConfirmModal } from '../../../src/client/components/ConfirmModal';

describe('CHK-MOD-04-TOUCH: Minimum 48x48px Hit Targets (NFR-009)', () => {
  it('enforces >= 48px hit dimensions on all HeaderBar interactive buttons', () => {
    render(
      <HeaderBar
        connectionStatus="connected"
        isMockMode={true}
        onClearSession={() => {}}
        onToggleInspector={() => {}}
        isInspectorOpen={false}
        onChangeViewport={() => {}}
      />
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);

    for (const btn of buttons) {
      const cls = btn.className;
      const has48pxMinHeight =
        cls.includes('min-h-[48px]') ||
        cls.includes('min-h-[52px]') ||
        cls.includes('min-h-[56px]') ||
        cls.includes('h-12');
      const has48pxMinWidth =
        cls.includes('min-w-[48px]') ||
        cls.includes('px-') ||
        cls.includes('w-');

      expect(has48pxMinHeight, `Button "${btn.getAttribute('aria-label') || btn.textContent}" must enforce >=48px min height`).toBe(true);
      expect(has48pxMinWidth, `Button "${btn.getAttribute('aria-label') || btn.textContent}" must enforce >=48px min width`).toBe(true);
    }
  });

  it('enforces >= 48px hit dimensions on all PersonaQuickSelect chips', () => {
    render(<PersonaQuickSelect onSelectPersona={() => {}} />);

    const chips = screen.getAllByRole('button');
    expect(chips.length).toBe(3);

    for (const chip of chips) {
      const cls = chip.className;
      expect(cls).toContain('min-h-[48px]');
    }
  });

  it('enforces >= 48px hit dimensions on RecipeCard primary action button', () => {
    render(
      <RecipeCard
        id="rec-1"
        title="Test Recipe"
        photoUrl=""
        prepTimeMinutes={10}
        servings={2}
        macros={{ calories: 400, proteinGrams: 30, carbsGrams: 40, fatsGrams: 10 }}
        allergenCertifications={[]}
        estimatedCost={15.0}
        onStartCooking={() => {}}
      />
    );

    const btn = screen.getByTestId('btn-start-cooking');
    const cls = btn.className;
    const hasAdequateHeight = cls.includes('min-h-[52px]') || cls.includes('min-h-[56px]') || cls.includes('min-h-[48px]');
    expect(hasAdequateHeight).toBe(true);
  });

  it('enforces >= 48px hit dimensions on BundleCarousel item swap buttons', () => {
    render(
      <BundleCarousel
        bundleId="b-1"
        recipeName="Test Recipe"
        items={[
          {
            sku: 'SKU-1',
            name: 'Item 1',
            photoUrl: '',
            packageQuantity: '1 pc',
            unitPrice: 5.0,
            inStock: true,
            allergenTags: [],
          },
        ]}
        totalPrice={5.0}
        onSwapItem={() => {}}
        onAddToCart={() => {}}
      />
    );

    const swapBtn = screen.getByTestId('btn-swap-SKU-1');
    expect(swapBtn.className).toContain('min-h-[48px]');
    expect(swapBtn.className).toContain('min-w-[48px]');
  });

  it('enforces >= 48px hit dimensions on CartSummaryDock add button', () => {
    render(
      <CartSummaryDock
        itemCount={1}
        subtotal={10}
        estimatedTax={1}
        total={11}
        version={1}
        onAddToCart={() => {}}
      />
    );

    const addBtn = screen.getByTestId('btn-add-bundle-cart');
    const hasAdequateHeight =
      addBtn.className.includes('min-h-[52px]') ||
      addBtn.className.includes('min-h-[56px]') ||
      addBtn.className.includes('min-h-[48px]');
    expect(hasAdequateHeight).toBe(true);
  });

  it('enforces >= 48px hit dimensions on ConfirmModal action buttons', () => {
    render(
      <ConfirmModal
        isOpen={true}
        title="Test Modal"
        message="Test message"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );

    const cancelBtn = screen.getByTestId('btn-modal-cancel');
    const confirmBtn = screen.getByTestId('btn-modal-confirm');
    expect(cancelBtn.className).toContain('min-h-[48px]');
    expect(confirmBtn.className).toContain('min-h-[48px]');
  });
});
