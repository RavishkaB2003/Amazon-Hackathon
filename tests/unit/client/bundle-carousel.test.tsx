import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BundleCarousel } from '../../../src/client/components/BundleCarousel';
import type { BundleItem } from '../../../src/client/types/ui';

describe('CHK-MOD-04-CAROUSEL: Ingredient Bundle Carousel (FR-018, NFR-003)', () => {
  const mockItems: BundleItem[] = [
    {
      sku: 'SKU-01',
      name: 'Wild Sockeye Salmon',
      photoUrl: 'https://example.com/salmon.jpg',
      packageQuantity: '1 lb fresh',
      unitPrice: 12.99,
      inStock: true,
      allergenTags: ['Fish'],
    },
    {
      sku: 'SKU-02',
      name: 'Organic Quinoa',
      photoUrl: 'https://example.com/quinoa.jpg',
      packageQuantity: '16 oz dry',
      unitPrice: 4.49,
      inStock: true,
      allergenTags: ['Gluten-Free'],
    },
  ];

  const defaultProps = {
    bundleId: 'bundle-001',
    recipeName: 'Mediterranean Salmon Bowl',
    items: mockItems,
    totalPrice: 17.48,
    maxBudget: 25.0,
    savingsAmount: 3.5,
    onSwapItem: vi.fn(),
    onAddToCart: vi.fn(),
  };

  it('renders carousel header with recipe name, total price, and budget pill', () => {
    render(<BundleCarousel {...defaultProps} />);

    expect(screen.getByText(/For: Mediterranean Salmon Bowl/)).toBeDefined();
    expect(screen.getByTestId('bundle-total-price').textContent).toBe('$17.48');
    expect(screen.getByTestId('budget-status-badge').textContent).toContain('Within $25.00 Budget');
    expect(screen.getByTestId('savings-badge').textContent).toContain('Saved $3.50');
  });

  it('renders warning when bundle exceeds maxBudget', () => {
    render(<BundleCarousel {...defaultProps} totalPrice={28.5} maxBudget={25.0} />);

    expect(screen.getByTestId('budget-status-badge').textContent).toContain('Over Budget');
  });

  it('renders horizontal scrollable snap track', () => {
    render(<BundleCarousel {...defaultProps} />);

    const track = screen.getByTestId('carousel-track');
    expect(track.className).toContain('overflow-x-auto');
    expect(track.className).toContain('snap-x');
  });

  it('renders each ingredient item with standalone photo and topmost title (#GUARDRAIL 2, #GUARDRAIL 3)', () => {
    render(<BundleCarousel {...defaultProps} />);

    const item1 = screen.getByTestId('bundle-item-SKU-01');
    expect(item1).toBeDefined();

    const title1 = screen.getByTestId('item-title-SKU-01');
    expect(title1.textContent).toBe('Wild Sockeye Salmon');

    // Title is the first element in the text panel
    const textPanel = item1.querySelector('div:nth-child(2)');
    expect(textPanel?.firstElementChild).toBe(title1);
  });

  it('triggers onSwapItem callback when Swap button is clicked', () => {
    const onSwap = vi.fn();
    render(<BundleCarousel {...defaultProps} onSwapItem={onSwap} />);

    const swapBtn = screen.getByTestId('btn-swap-SKU-01');
    fireEvent.click(swapBtn);

    expect(onSwap).toHaveBeenCalledWith('SKU-01');
  });
});
