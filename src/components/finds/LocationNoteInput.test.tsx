import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocationNoteInput } from './LocationNoteInput';

describe('LocationNoteInput', () => {
  // Test 1: case-insensitive filtering shows only matching suggestion
  it('shows only matching suggestions (case-insensitive) when user types', () => {
    const onChange = vi.fn();
    render(
      <LocationNoteInput
        value="gor"
        onChange={onChange}
        suggestions={['Gorski kotar', 'Učka', 'šuma']}
      />,
    );

    // "gor" should match "Gorski kotar" case-insensitively
    expect(screen.getByText('Gorski kotar')).toBeInTheDocument();
    expect(screen.queryByText('Učka')).toBeNull();
    expect(screen.queryByText('šuma')).toBeNull();
  });

  // Test 2: deduplication — only one entry per unique lowercase value
  it('does not show duplicate suggestions for same lowercase value', () => {
    const onChange = vi.fn();
    render(
      <LocationNoteInput
        value="gor"
        onChange={onChange}
        suggestions={['Gorski kotar', 'gorski kotar', 'Učka']}
      />,
    );

    const items = screen.queryAllByText('Gorski kotar');
    // Only one entry should render even if two variants exist in the list
    // (The parent should pass a deduplicated list, so both values pass the filter —
    // but this tests that the component renders each key only once)
    expect(items.length).toBe(1);
    expect(screen.queryByText('gorski kotar')).toBeNull();
  });

  // Test 3: empty/whitespace suggestions never appear
  it('never shows empty or whitespace-only entries from suggestions', () => {
    const onChange = vi.fn();
    render(
      <LocationNoteInput
        value="g"
        onChange={onChange}
        suggestions={['', '  ', 'Gorski kotar']}
      />,
    );

    expect(screen.getByText('Gorski kotar')).toBeInTheDocument();
    // Empty and whitespace items should not render as suggestion buttons
    const buttons = screen.queryAllByRole('button');
    buttons.forEach((btn) => {
      expect(btn.textContent?.trim()).not.toBe('');
    });
  });

  // Test 4: clicking a suggestion calls onChange and closes dropdown
  it('calls onChange with the suggestion value when suggestion is clicked', () => {
    const onChange = vi.fn();
    render(
      <LocationNoteInput
        value="gor"
        onChange={onChange}
        suggestions={['Gorski kotar', 'Učka']}
      />,
    );

    const suggestion = screen.getByText('Gorski kotar');
    fireEvent.mouseDown(suggestion);

    expect(onChange).toHaveBeenCalledWith('Gorski kotar');

    // Dropdown should be closed after selection — suggestion should no longer be in the DOM
    expect(screen.queryByText('Gorski kotar')).toBeNull();
  });

  // Test 5: custom value not in suggestions — onChange still fires normally
  it('allows custom values not in suggestions and fires onChange on input change', () => {
    const onChange = vi.fn();
    render(
      <LocationNoteInput
        value=""
        onChange={onChange}
        suggestions={['Gorski kotar']}
      />,
    );

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Moja lokacija' } });

    expect(onChange).toHaveBeenCalledWith('Moja lokacija');
  });

  // Test 6: keyboard ArrowDown then Enter selects highlighted suggestion
  it('selects suggestion with ArrowDown + Enter keyboard navigation', () => {
    const onChange = vi.fn();
    render(
      <LocationNoteInput
        value="gor"
        onChange={onChange}
        suggestions={['Gorski kotar', 'Goranska šuma']}
      />,
    );

    const input = screen.getByRole('textbox');

    // ArrowDown moves highlight to index 0 (already there) — press ArrowDown again to move to index 1
    fireEvent.keyDown(input, { key: 'ArrowDown' });

    // Enter selects the highlighted suggestion (index 1 after first ArrowDown from 0)
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith('Goranska šuma');
  });
});
