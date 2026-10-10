import type { Map as MapLibreMap } from 'maplibre-gl';

/** An area's feature state on the polygon source; the fill and focus layers read it. */
export interface AreaState {
  /** Palette slot of its neighbour tint (AreaColouring), or null before the polygons are read. */
  readonly tint: number | null;
  /** Its score colour (ChoroplethScale), or null while no score shows. */
  readonly fill: string | null;
  readonly scored: boolean;
  /** Tapped, open, or where the person stands: the thick outline. */
  readonly focus: boolean;
}

/** Keeps each area's feature state in step with its tint, its score colour and the focus. */
export class AreaStates {
  readonly #map: MapLibreMap;
  readonly #source: string;
  #colors: ReadonlyMap<string, string> = new Map();
  #tints: ReadonlyMap<string, number> = new Map();
  #focus: string | null = null;

  constructor(map: MapLibreMap, source: string) {
    this.#map = map;
    this.#source = source;
  }

  get focus(): string | null {
    return this.#focus;
  }

  paint(colors: ReadonlyMap<string, string>): void {
    this.#colors = colors;
    this.apply();
  }

  tint(tints: ReadonlyMap<string, number>): void {
    this.#tints = tints;
    this.apply();
  }

  /** Returns whether the focus moved. */
  setFocus(id: string | null): boolean {
    if (id === this.#focus) return false;
    this.#focus = id;
    this.apply();
    return true;
  }

  state(id: string): AreaState {
    const fill = this.#colors.get(id) ?? null;
    return { tint: this.#tints.get(id) ?? null, fill, scored: fill !== null, focus: id === this.#focus };
  }

  /** Writes every area's state afresh, once the polygon source is on the map. */
  apply(): void {
    if (!this.#map.getSource(this.#source)) return;
    this.#map.removeFeatureState({ source: this.#source });
    const ids = new Set([...this.#tints.keys(), ...this.#colors.keys()]);
    if (this.#focus) ids.add(this.#focus);
    for (const id of ids) this.#map.setFeatureState({ source: this.#source, id }, { ...this.state(id) });
  }
}
