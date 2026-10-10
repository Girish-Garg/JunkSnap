import type { FeatureCollection, Point } from 'geojson';
import { BOUNDARY_KINDS, type BoundaryKind } from '../domain/AreaListing';

type Fetch = typeof fetch;

/** How many of a local body's wards the ward layer maps; `wards` is null when the count is unknown. */
export interface WardCoverage {
  readonly town: string;
  readonly mapped: number;
  readonly wards: number | null;
}

/** Which boundary kinds have a file (and a fine file for close zooms), and how complete the ward layer is. */
export interface BoundaryIndex {
  readonly kinds: readonly BoundaryKind[];
  readonly fine: readonly BoundaryKind[];
  readonly wardCoverage: readonly WardCoverage[];
  /** Credit lines from the index, by kind, where a layer brings its own (wards). */
  readonly attribution: Partial<Readonly<Record<BoundaryKind, string>>>;
}

/** One marker point per area (its pole of inaccessibility), with the area id and name. */
export type LabelPoints = FeatureCollection<Point, { readonly id: string; readonly name: string }>;

interface LayerEntry {
  readonly coverage?: readonly WardCoverage[];
  readonly fine?: unknown;
  readonly attribution?: string;
}

interface Manifest {
  readonly layers?: Readonly<Record<string, LayerEntry | undefined>>;
}

// File names written by scripts/simplify_boundaries.py into public/boundaries/.
const FILES: Readonly<Record<BoundaryKind, string>> = { ward: 'wards', assembly: 'assembly', loksabha: 'loksabha' };
const EMPTY: BoundaryIndex = { kinds: [], fine: [], wardCoverage: [], attribution: {} };

/** The simplified boundary files served with the app; wards appear once the crawler's files are simplified. */
export class BoundaryCatalog {
  readonly #baseUrl: string;
  readonly #fetch: Fetch;

  constructor(baseUrl: string, fetchImpl: Fetch = (input, init) => fetch(input, init)) {
    this.#baseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    this.#fetch = fetchImpl;
  }

  /** The app's own folder, as an absolute URL so MapLibre's workers can fetch it. */
  static defaultBaseUrl(): string {
    return new URL(`${import.meta.env.BASE_URL}boundaries/`, globalThis.location.href).href;
  }

  /** Kinds with a file, in BOUNDARY_KINDS order, fine files and ward coverage; nothing when unreadable. */
  async index(): Promise<BoundaryIndex> {
    try {
      const response = await this.#fetch(`${this.#baseUrl}index.json`);
      if (!response.ok) return EMPTY;
      const layers = ((await response.json()) as Manifest).layers ?? {};
      const kinds = BOUNDARY_KINDS.filter((kind) => layers[FILES[kind]] !== undefined);
      const fine = kinds.filter((kind) => layers[FILES[kind]]?.fine !== undefined);
      const attribution = Object.fromEntries(
        kinds.flatMap((kind) => {
          const text = layers[FILES[kind]]?.attribution;
          return text ? [[kind, text]] : [];
        }),
      );
      return { kinds, fine, wardCoverage: layers[FILES.ward]?.coverage ?? [], attribution };
    } catch (error) {
      console.error('Could not read the boundary index', error);
      return EMPTY;
    }
  }

  /** The marker points; the map joins each area's name and value onto them. */
  async labels(kind: BoundaryKind): Promise<LabelPoints> {
    const response = await this.#fetch(this.labelsUrl(kind));
    if (!response.ok) throw new Error(`Could not load ${kind} markers: ${response.status}`);
    return (await response.json()) as LabelPoints;
  }

  polygonsUrl(kind: BoundaryKind): string {
    return `${this.#baseUrl}${FILES[kind]}.geojson`;
  }

  /** Original edges for close zooms; only for kinds listed in the index's `fine`. */
  fineUrl(kind: BoundaryKind): string {
    return `${this.#baseUrl}${FILES[kind]}_fine.geojson`;
  }

  labelsUrl(kind: BoundaryKind): string {
    return `${this.#baseUrl}${FILES[kind]}_labels.geojson`;
  }
}
