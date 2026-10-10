import type { FeatureCollection, Point } from 'geojson';
import { AreaColouring } from '../domain/AreaColouring';
import type { AreaPolygons, AreaShapes } from '../domain/AreaShapes';

type Fetch = typeof fetch;

/** The map's areas layer: whether it exists, has an original-edge file for close zooms, and its credit. */
export interface AreasIndex {
  readonly available: boolean;
  readonly fine: boolean;
  readonly attribution: string | null;
  /** Changes whenever scripts/simplify_boundaries.py writes new files (feature count and sizes). */
  readonly version: string;
}

/** The kind of seat an area of the map is; assembly where seats exist, Lok Sabha elsewhere. */
export type MapAreaKind = 'assembly' | 'loksabha';

/** One marker point per area (its pole of inaccessibility), with the area id, name and kind. */
export type LabelPoints = FeatureCollection<
  Point,
  { readonly id: string; readonly name: string; readonly kind: MapAreaKind }
>;

interface LayerEntry {
  readonly features?: number;
  readonly bytes?: number;
  readonly fine?: unknown;
  readonly attribution?: string;
}

interface Manifest {
  readonly layers?: Readonly<Record<string, LayerEntry | undefined>>;
}

// Written by scripts/simplify_boundaries.py into public/boundaries/, which ships only the areas
// layer (areas.geojson, areas_labels.geojson, areas_fine.geojson) and index.json.
const AREAS = 'areas';
const NONE: AreasIndex = { available: false, fine: false, attribution: null, version: '' };

/** The boundary files served with the app. */
export class BoundaryCatalog {
  readonly #baseUrl: string;
  readonly #fetch: Fetch;
  #labels: Promise<LabelPoints> | null = null;
  #polygons: Promise<AreaPolygons> | null = null;
  #shapes: { readonly key: string; readonly shapes: Promise<AreaShapes> } | null = null;

  constructor(baseUrl: string, fetchImpl: Fetch = (input, init) => fetch(input, init)) {
    this.#baseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    this.#fetch = fetchImpl;
  }

  /** The app's own folder, as an absolute URL so MapLibre's workers can fetch it. */
  static defaultBaseUrl(): string {
    return new URL(`${import.meta.env.BASE_URL}boundaries/`, globalThis.location.href).href;
  }

  /** What the index says about the areas layer; nothing when it cannot be read. */
  async index(): Promise<AreasIndex> {
    try {
      const response = await this.#fetch(`${this.#baseUrl}index.json`);
      if (!response.ok) return NONE;
      const entry = ((await response.json()) as Manifest).layers?.[AREAS];
      if (!entry) return NONE;
      const version = `${String(entry.features ?? 0)}-${String(entry.bytes ?? 0)}`;
      return { available: true, fine: entry.fine !== undefined, attribution: entry.attribution ?? null, version };
    } catch (error) {
      console.error('Could not read the boundary index', error);
      return NONE;
    }
  }

  /** The marker points, fetched once for the map and search; a failed fetch is tried again next time. */
  labels(): Promise<LabelPoints> {
    this.#labels ??= this.#fetchLabels().catch((error: unknown) => {
      this.#labels = null;
      throw error;
    });
    return this.#labels;
  }

  /**
   * The area polygons the map draws, fetched once on the main thread to tell neighbours apart and to find the
   * area someone stands in (MapLibre loads the same URL in its worker; the browser revalidates it by ETag).
   */
  polygons(): Promise<AreaPolygons> {
    this.#polygons ??= this.#fetchJson<AreaPolygons>(this.polygonsUrl(), 'area polygons').catch((error: unknown) => {
      this.#polygons = null;
      throw error;
    });
    return this.#polygons;
  }

  /**
   * The area polygons with each area's neighbour tint slot, read and coloured once per index version and number
   * of slots, then shared by the map, its card and the Areas tab. A failed read is tried again next time.
   */
  areaShapes(version: string, slots: number): Promise<AreaShapes> {
    const key = `${version}|${String(slots)}`;
    if (this.#shapes?.key === key) return this.#shapes.shapes;
    const shapes = this.polygons().then((polygons) => AreaColouring.shapes(polygons, slots));
    this.#shapes = { key, shapes };
    shapes.catch(() => {
      if (this.#shapes?.shapes === shapes) this.#shapes = null;
    });
    return shapes;
  }

  #fetchLabels(): Promise<LabelPoints> {
    return this.#fetchJson<LabelPoints>(this.labelsUrl(), 'area markers');
  }

  async #fetchJson<T>(url: string, what: string): Promise<T> {
    const response = await this.#fetch(url);
    if (!response.ok) throw new Error(`Could not load the ${what}: ${response.status}`);
    return (await response.json()) as T;
  }

  polygonsUrl(): string {
    return `${this.#baseUrl}${AREAS}.geojson`;
  }

  /** Original edges for close zooms, when the index lists them. */
  fineUrl(): string {
    return `${this.#baseUrl}${AREAS}_fine.geojson`;
  }

  labelsUrl(): string {
    return `${this.#baseUrl}${AREAS}_labels.geojson`;
  }
}
