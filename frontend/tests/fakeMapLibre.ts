// A stand-in for maplibre-gl in jsdom (no WebGL): it records handlers, markers, sources and layers,
// so a test can replay a pin drag or a map tap. Use with vi.mock('maplibre-gl', () => import('./fakeMapLibre')).
type Handler = (event?: unknown) => void;

export const created = { maps: [] as Map[], markers: [] as Marker[] };

class FakeSource {
  data: unknown = null;

  setData(data: unknown): void {
    this.data = data;
  }
}

export class Map {
  readonly handlers = new globalThis.Map<string, Handler>();
  readonly sources = new globalThis.Map<string, FakeSource>();
  readonly layers: { id: string }[] = [];
  removed = false;
  readonly options: { container: HTMLElement; cooperativeGestures?: boolean; locale?: Record<string, string> };

  constructor(options: { container: HTMLElement; cooperativeGestures?: boolean; locale?: Record<string, string> }) {
    this.options = options;
    created.maps.push(this);
  }

  addControl(): void {}

  on(name: string, handler: Handler): void {
    this.handlers.set(name, handler);
  }

  getContainer(): HTMLElement {
    return this.options.container;
  }

  addSource(id: string): void {
    this.sources.set(id, new FakeSource());
  }

  addLayer(layer: { id: string }): void {
    this.layers.push(layer);
  }

  getSource(id: string): FakeSource | undefined {
    return this.sources.get(id);
  }

  remove(): void {
    this.removed = true;
  }
}

export class Marker {
  readonly handlers = new globalThis.Map<string, Handler>();
  lngLat: [number, number] = [0, 0];
  readonly options: { element: HTMLElement; draggable?: boolean };

  constructor(options: { element: HTMLElement; draggable?: boolean }) {
    this.options = options;
    created.markers.push(this);
  }

  setLngLat(lngLat: [number, number]): this {
    this.lngLat = lngLat;
    return this;
  }

  getLngLat(): { lng: number; lat: number } {
    return { lng: this.lngLat[0], lat: this.lngLat[1] };
  }

  addTo(): this {
    return this;
  }

  on(name: string, handler: Handler): void {
    this.handlers.set(name, handler);
  }
}

export class AttributionControl {}
