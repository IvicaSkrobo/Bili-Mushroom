import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

const addToSpy = vi.fn();
const removeSpy = vi.fn();

vi.mock('react-leaflet', () => ({
  useMap: () => ({}),
}));

// Capture the onAdd return so we can assert on rendered DOM text
let lastRendered: HTMLElement | null = null;
vi.mock('leaflet', () => {
  const DomUtil = {
    create: (tag: string, _cls?: string, parent?: HTMLElement) => {
      const el = document.createElement(tag || 'div');
      if (parent) parent.appendChild(el);
      return el;
    },
  };
  const Control = class {
    options: any;
    constructor(opts: any) { this.options = opts; }
    addTo() { addToSpy(); return this; }
    remove() { removeSpy(); }
  };
  (Control as any).extend = (def: any) => {
    return class extends Control {
      constructor(opts: any) {
        super(opts);
        const node = def.onAdd.call(this);
        lastRendered = node;
      }
    };
  };
  return { default: { Control, DomUtil }, Control, DomUtil };
});

import { OnlineStatusBadge } from './OnlineStatusBadge';

describe('OnlineStatusBadge', () => {
  it('adds a control showing "Online" when navigator.onLine is true', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    render(<OnlineStatusBadge />);
    expect(addToSpy).toHaveBeenCalled();
    expect(lastRendered?.textContent).toContain('Online');
  });

  it('shows "Cached" when navigator.onLine is false', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    render(<OnlineStatusBadge />);
    expect(lastRendered?.textContent).toContain('Cached');
  });
});
