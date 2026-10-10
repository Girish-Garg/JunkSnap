import { BOUNDARY_KINDS, type BoundaryKind } from '../domain/AreaListing';

type Fetch = typeof fetch;

/** How many of a local body's wards the ward layer maps; `wards` is null when the count is unknown. */
export interface WardCoverage {
  readonly town: string;
  readonly mapped: number;
  readonly wards: number | null;
}

/** Which boundary kinds have a file, and how complete the ward layer is. */
export interface BoundaryIndex {
  readonly kinds: readonly BoundaryKind[];
  readonly wardCoverage: readonly WardCoverage[];
}

interface Manifest {
  readonly layers?: Readonly<Record<string, { readonly coverage?: readonly WardCoverage[] } | undefined>>;
}

// File names written by scripts/simplify_boundaries.py into public/boundaries/.
const FILES: Readonly<Record<BoundaryKind, string>> = { ward: 'wards', assembly: 'assembly', loksabha: 'loksabha' };
const EMPTY: BoundaryIndex = { kinds: [], wardCoverage: [] };

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

  /** Kinds with a file, in BOUNDARY_KINDS order, and ward coverage; nothing when the index cannot be read. */
  async index(): Promise<BoundaryIndex> {
    try {
      const response = await this.#fetch(`${this.#baseUrl}index.json`);
      if (!response.ok) return EMPTY;
      const layers = ((await response.json()) as Manifest).layers ?? {};
      const kinds = BOUNDARY_KINDS.filter((kind) => layers[FILES[kind]] !== undefined);
      return { kinds, wardCoverage: layers[FILES.ward]?.coverage ?? [] };
    } catch (error) {
      console.error('Could not read the boundary index', error);
      return EMPTY;
    }
  }

  polygonsUrl(kind: BoundaryKind): string {
    return `${this.#baseUrl}${FILES[kind]}.geojson`;
  }

  labelsUrl(kind: BoundaryKind): string {
    return `${this.#baseUrl}${FILES[kind]}_labels.geojson`;
  }
}
