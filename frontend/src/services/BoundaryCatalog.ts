import type { FeatureCollection, Point } from 'geojson';
import type { Clock } from './Clock';
import { ExpiringCache, type CachePolicy, type Tagged } from './ExpiringCache';
import { SystemClock } from './SystemClock';

type Fetch = typeof fetch;

/** The map's areas layer: whether it exists, has an original-edge file for close zooms, and its credit. */
export interface AreasIndex {
  readonly available: boolean;
  readonly fine: boolean;
  readonly attribution: string | null;
}

/** The kind of seat an area of the map is; assembly where seats exist, Lok Sabha elsewhere. */
export type MapAreaKind = 'assembly' | 'loksabha';

/** One marker point per area (its pole of inaccessibility), with the area id, name and kind. */
export type LabelPoints = FeatureCollection<
  Point,
  { readonly id: string; readonly name: string; readonly kind: MapAreaKind }
>;

interface LayerEntry {
  readonly fine?: unknown;
  readonly attribution?: string;
  /** Content hash of the layer's files, written by scripts/simplify_boundaries.py. */
  readonly version?: string;
}

interface Manifest {
  readonly layers?: Readonly<Record<string, LayerEntry | undefined>>;
}

/** The areas layer as index.json lists it, with the version that stamps its file URLs. */
interface AreasEntry {
  readonly index: AreasIndex;
  readonly version: string | null;
}

/** The copies of index.json and of the marker points. */
export interface BoundaryCaches {
  readonly index: ExpiringCache<AreasEntry>;
  readonly labels: ExpiringCache<LabelPoints>;
}

// Written by scripts/simplify_boundaries.py into public/boundaries/, which ships only the areas
// layer (areas.geojson, areas_labels.geojson, areas_fine.geojson) and index.json.
const AREAS = 'areas';
const NONE: AreasIndex = { available: false, fine: false, attribution: null };
const NO_ENTRY: AreasEntry = { index: NONE, version: null };
// A session left open across a deploy reads the new index within 10 minutes.
const INDEX_POLICY: CachePolicy = { ttlMs: 10 * 60 * 1000, staleWhileRevalidate: true, maxEntries: 1 };
// The marker points never age; they are fetched again only when the index names another version.
const LABELS_POLICY: CachePolicy = { ttlMs: Number.POSITIVE_INFINITY, staleWhileRevalidate: false, maxEntries: 1 };

/** The boundary files served with the app; their URLs carry the index's version, so a new build busts old copies. */
export class BoundaryCatalog {
  readonly #baseUrl: string;
  readonly #fetch: Fetch;
  readonly #caches: BoundaryCaches;
  #version: string | null = null;

  constructor(
    baseUrl: string,
    fetchImpl: Fetch = (input, init) => fetch(input, init),
    caches: BoundaryCaches = BoundaryCatalog.caches(new SystemClock()),
  ) {
    this.#baseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    this.#fetch = fetchImpl;
    this.#caches = caches;
  }

  static caches(clock: Clock): BoundaryCaches {
    return { index: new ExpiringCache(INDEX_POLICY, clock), labels: new ExpiringCache(LABELS_POLICY, clock) };
  }

  /** The app's own folder, as an absolute URL so MapLibre's workers can fetch it. */
  static defaultBaseUrl(): string {
    return new URL(`${import.meta.env.BASE_URL}boundaries/`, globalThis.location.href).href;
  }

  /** What the index says about the areas layer; nothing when it cannot be read. */
  async index(): Promise<AreasIndex> {
    return (await this.#areas()).index;
  }

  /** The marker points for the map and search, kept until the index names a new version; a failure is tried again. */
  async labels(): Promise<LabelPoints> {
    const { version } = await this.#areas();
    return this.#caches.labels.get({ key: AREAS, token: version, load: () => this.#fetchLabels(version) });
  }

  polygonsUrl(): string {
    return this.#url(`${AREAS}.geojson`);
  }

  /** Original edges for close zooms, when the index lists them. */
  fineUrl(): string {
    return this.#url(`${AREAS}_fine.geojson`);
  }

  labelsUrl(): string {
    return this.#url(`${AREAS}_labels.geojson`);
  }

  async #areas(): Promise<AreasEntry> {
    try {
      const entry = await this.#caches.index.get({ key: AREAS, load: () => this.#fetchIndex() });
      this.#version = entry.version;
      return entry;
    } catch (error) {
      console.error('Could not read the boundary index', error);
      return NO_ENTRY;
    }
  }

  // no-cache: the browser always asks the host (with its ETag), so a deploy's new index is never missed.
  async #fetchIndex(): Promise<Tagged<AreasEntry>> {
    const response = await this.#fetch(`${this.#baseUrl}index.json`, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`The boundary index answered ${response.status}`);
    const entry = ((await response.json()) as Manifest).layers?.[AREAS];
    if (!entry) return { value: NO_ENTRY, token: null };
    const index = { available: true, fine: entry.fine !== undefined, attribution: entry.attribution ?? null };
    const version = entry.version ?? null;
    return { value: { index, version }, token: version };
  }

  async #fetchLabels(version: string | null): Promise<Tagged<LabelPoints>> {
    const response = await this.#fetch(this.labelsUrl());
    if (!response.ok) throw new Error(`Could not load the area markers: ${response.status}`);
    return { value: (await response.json()) as LabelPoints, token: version };
  }

  #url(file: string): string {
    const stamp = this.#version ? `?v=${encodeURIComponent(this.#version)}` : '';
    return `${this.#baseUrl}${file}${stamp}`;
  }
}
