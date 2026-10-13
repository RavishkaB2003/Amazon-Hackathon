import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CartSummaryDock } from '../../../src/client/components/CartSummaryDock';

describe('CHK-MOD-04-CART-DOCK: Cart Summary Dock & OCC 409 Concurrency (FR-008, CTRL-12)', () => {
  const defaultProps = {
    itemCount: 5,
    subtotal: 25.0,
    estimatedTax: 2.0,
    total: 27.0,
    maxBudget: 30.0,
    savingsAmount: 4.0,
    version: 1,
    onAddToCart: vi.fn(),
  };

  it('renders cart metrics: item count, subtotal, tax, total, and budget compliance', () => {
    render(<CartSummaryDock {...defaultProps} />);

    expect(screen.getByTestId('cart-item-count').textContent).toBe('5');
    expect(screen.getByTestId('cart-subtotal').textContent).toBe('$25.00');
    expect(screen.getByTestId('cart-tax').textContent).toBe('$2.00');
    expect(screen.getByTestId('cart-total-amount').textContent).toBe('$27.00');
    expect(screen.getByTestId('dock-budget-pill').textContent).toContain('Within $30.00 Budget');
    expect(screen.getByTestId('dock-savings-pill').textContent).toContain('Save $4.00');
  });

  it('triggers onAddToCart when 1-tap add button is clicked', () => {
    const onAdd = vi.fn();
    render(<CartSummaryDock {...defaultProps} onAddToCart={onAdd} />);

    const button = screen.getByTestId('btn-add-bundle-cart');
    fireEvent.click(button);

    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('shows loading state on button when isAdding is true', () => {
    render(<CartSummaryDock {...defaultProps} isAdding={true} />);

    const button = screen.getByTestId('btn-add-bundle-cart');
    expect(button.textContent).toContain('Adding to Cart...');
    expect(button.getAttribute('disabled')).toBeDefined();
  });

  it('renders OCC 409 conflict alert when isConflict is true and handles resolve', () => {
    const onResolve = vi.fn();
    render(
      <CartSummaryDock
        {...defaultProps}
        version={2}
        isConflict={true}
        onResolveConflict={onResolve}
      />
    );

    const alert = screen.getByTestId('cart-conflict-alert');
    expect(alert).toBeDefined();
    expect(alert.textContent).toContain('Cart changed by concurrent action (Version 2)');

    const refreshBtn = screen.getByRole('button', { name: /Resolve conflict and refresh cart/ });
    fireEvent.click(refreshBtn);

    expect(onResolve).toHaveBeenCalledTimes(1);
  });
});
