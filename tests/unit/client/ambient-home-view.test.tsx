import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AmbientHomeView } from '../../../src/client/components/AmbientHomeView';

describe('AmbientHomeView: The Clean Approach (SCR-001)', () => {
  it('renders ambient clock, contextual greeting, and input box with >= 48px hit dimensions', () => {
    const handleSearch = vi.fn();
    render(<AmbientHomeView onSearch={handleSearch} />);

    // Renders clock & greeting
    expect(screen.getByTestId('ambient-clock')).toBeDefined();
    expect(screen.getByTestId('ambient-date')).toBeDefined();

    // Natural input box
    const input = screen.getByTestId('ambient-input-box');
    expect(input).toBeDefined();

    // 3 starter prompt chips
    const chip0 = screen.getByTestId('starter-prompt-0');
    const chip1 = screen.getByTestId('starter-prompt-1');
    const chip2 = screen.getByTestId('starter-prompt-2');

    expect(chip0.className).toContain('min-h-[48px]');
    expect(chip1.className).toContain('min-h-[48px]');
    expect(chip2.className).toContain('min-h-[48px]');
  });

  it('triggers onSearch when starter prompt chip is clicked', () => {
    const handleSearch = vi.fn();
    render(<AmbientHomeView onSearch={handleSearch} />);

    const chip0 = screen.getByTestId('starter-prompt-0');
    fireEvent.click(chip0);

    expect(handleSearch).toHaveBeenCalledTimes(1);
    expect(handleSearch).toHaveBeenCalledWith('Quick 15-minute high dopamine dinner for 1 under $20');
  });

  it('triggers onSearch when text is typed and form is submitted', () => {
    const handleSearch = vi.fn();
    render(<AmbientHomeView onSearch={handleSearch} />);

    const input = screen.getByTestId('ambient-input-box');
    fireEvent.change(input, { target: { value: 'Cook salmon for 2' } });
    fireEvent.submit(input.closest('form')!);

    expect(handleSearch).toHaveBeenCalledWith('Cook salmon for 2');
  });
});
