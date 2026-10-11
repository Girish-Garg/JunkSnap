// A stand-in for maplibre-gl in jsdom (no WebGL) for SiteMap and its BasemapWatch: it records listeners and
// setStyle calls, and every other map method does nothing. Use with vi.mock('maplibre-gl', () => import('./fakeBasemap')).
import { vi } from 'vitest';

type Handler = (event?: unknown) => void;

export const made: Map[] = [];

export class Map {
  readonly listeners = new globalThis.Map<string, Set<Handler>>();
  readonly setStyle = vi.fn();
  readonly container: HTMLElement;

  constructor(options: { container: HTMLElement }) {
    this.container = options.container;
    made.push(this);
    return new Proxy(this, { get: (target, key) => (key in target ? Reflect.get(target, key) : () => undefined) });
  }

  on(name: string, ...rest: unknown[]): void {
    const handler = rest.at(-1) as Handler;
    this.listeners.set(name, (this.listeners.get(name) ?? new Set()).add(handler));
  }

  off(name: string, handler: Handler): void {
    this.listeners.get(name)?.delete(handler);
  }

  /** Fires a map event, as MapLibre would. */
  emit(name: string, event: object = {}): void {
    for (const handler of [...(this.listeners.get(name) ?? [])]) handler(event);
  }

  getContainer(): HTMLElement {
    return this.container;
  }
}

export class AttributionControl {}
export class LngLatBounds {}
export class Marker {}
export class Popup {}
