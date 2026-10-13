import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RecipeCard } from '../../../src/client/components/RecipeCard';

describe('CHK-MOD-04-RECIPE: RecipeCard & DESIGN.md Guardrails (FR-017, CR-001)', () => {
  const mockProps = {
    id: 'rec-mediterranean-salmon',
    title: 'Mediterranean Salmon Bowl',
    photoUrl: 'https://example.com/salmon.jpg',
    prepTimeMinutes: 10,
    cookTimeMinutes: 15,
    servings: 2,
    macros: {
      calories: 520,
      proteinGrams: 42,
      carbsGrams: 38,
      fatsGrams: 22,
    },
    allergenCertifications: ['Dairy-Free', 'Peanut-Free'],
    estimatedCost: 29.75,
    onStartCooking: vi.fn(),
  };

  it('renders standalone photo in container above text panel (#GUARDRAIL 3)', () => {
    render(<RecipeCard {...mockProps} />);

    const img = screen.getByRole('img');
    expect(img).toBeDefined();
    expect(img.getAttribute('src')).toBe('https://example.com/salmon.jpg');
    expect(img.getAttribute('alt')).toBe('Mediterranean Salmon Bowl');
  });

  it('enforces Zero Text Above Headings (#GUARDRAIL 2)', () => {
    const { container } = render(<RecipeCard {...mockProps} />);

    const titleElement = screen.getByTestId('recipe-title');
    expect(titleElement.tagName).toBe('H2');
    expect(titleElement.textContent).toBe('Mediterranean Salmon Bowl');

    // The text panel is the second child of the card (index 1), following the photo container (index 0)
    const textPanel = container.querySelector('article > div:nth-child(2)');
    expect(textPanel).toBeDefined();

    // The very first element child inside the text panel MUST be the heading h2
    const firstChild = textPanel?.firstElementChild;
    expect(firstChild).toBe(titleElement);
  });

  it('renders all macronutrient pills with correct values', () => {
    render(<RecipeCard {...mockProps} />);

    expect(screen.getByTestId('macro-calories').textContent).toContain('520 kcal');
    expect(screen.getByTestId('macro-protein').textContent).toContain('42g Protein');
    expect(screen.getByTestId('macro-carbs').textContent).toContain('38g Carbs');
    expect(screen.getByTestId('macro-fats').textContent).toContain('22g Fat');
  });

  it('renders allergen badges with icons and labels', () => {
    render(<RecipeCard {...mockProps} />);

    expect(screen.getByTestId('allergen-badge-0').textContent).toContain('Dairy-Free');
    expect(screen.getByTestId('allergen-badge-1').textContent).toContain('Peanut-Free');
  });

  it('dispatches onStartCooking callback when primary button is clicked', () => {
    const onStart = vi.fn();
    render(<RecipeCard {...mockProps} onStartCooking={onStart} />);

    const button = screen.getByTestId('btn-start-cooking');
    fireEvent.click(button);

    expect(onStart).toHaveBeenCalledWith('rec-mediterranean-salmon');
  });

  it('strictly contains zero gradient classes (#GUARDRAIL 1)', () => {
    const { container } = render(<RecipeCard {...mockProps} />);

    const html = container.innerHTML;
    expect(html).not.toContain('bg-gradient');
    expect(html).not.toContain('gradient');
    expect(html).not.toContain('from-');
    expect(html).not.toContain('to-');
  });
});
