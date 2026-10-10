import { BOUNDARY_KINDS, type BoundaryKind } from '../domain/AreaListing';

type Fetch = typeof fetch;

interface Manifest {
  readonly layers?: Readonly<Record<string, unknown>>;
}

// File names written by scripts/simplify_boundaries.py into public/boundaries/.
const FILES: Readonly<Record<BoundaryKind, string>> = { ward: 'wards', assembly: 'assembly', loksabha: 'loksabha' };

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

  /** Kinds with a file, in BOUNDARY_KINDS order; none when the index cannot be read. */
  async available(): Promise<readonly BoundaryKind[]> {
    try {
      const response = await this.#fetch(`${this.#baseUrl}index.json`);
      if (!response.ok) return [];
      const manifest = (await response.json()) as Manifest;
      return BOUNDARY_KINDS.filter((kind) => manifest.layers?.[FILES[kind]] !== undefined);
    } catch (error) {
      console.error('Could not read the boundary index', error);
      return [];
    }
  }

  polygonsUrl(kind: BoundaryKind): string {
    return `${this.#baseUrl}${FILES[kind]}.geojson`;
  }

  labelsUrl(kind: BoundaryKind): string {
    return `${this.#baseUrl}${FILES[kind]}_labels.geojson`;
  }
}
