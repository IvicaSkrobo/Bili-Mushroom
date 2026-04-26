import { describe, it, expect, vi } from 'vitest';
import { act, render } from '@testing-library/react';

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
import { TILE_PROXY_ERROR_EVENT } from './RustProxyTileLayer';

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

  it('shows tile proxy errors emitted by the tile layer', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    render(<OnlineStatusBadge />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent(TILE_PROXY_ERROR_EVENT, {
          detail: {
            message: 'dns error for tile.openstreetmap.org',
            url: 'https://tile.openstreetmap.org/7/68/44.png',
            at: '2026-04-26T12:00:00.000Z',
          },
        }),
      );
    });

    expect(lastRendered?.textContent).toContain(
      'Tile proxy error: dns error for tile.openstreetmap.org',
    );
  });
});
