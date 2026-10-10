import type { Feature, FeatureCollection } from 'geojson';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import type { LabelPoints } from '../../services/BoundaryCatalog';
import type { AreaMarker } from './AreaMarkers';

export interface LabelLoader {
  labels(): Promise<LabelPoints>;
}

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

/** Keeps the marker source in step: the marker points joined with each area's current value. */
export class AreaMarkerSource {
  readonly #map: MapLibreMap;
  readonly #loader: LabelLoader;
  readonly #sourceId: string;
  #points: LabelPoints | null = null;
  #markers: ReadonlyMap<string, AreaMarker> = new Map();
  #request = 0;

  constructor(map: MapLibreMap, loader: LabelLoader, sourceId: string) {
    this.#map = map;
    this.#loader = loader;
    this.#sourceId = sourceId;
  }

  /** Points and values flat on each feature, since MapLibre layout expressions cannot read feature state. */
  static merge(points: LabelPoints | null, markers: ReadonlyMap<string, AreaMarker>): FeatureCollection {
    if (!points) return EMPTY;
    const features = points.features.map((point): Feature => {
      const marker = markers.get(point.properties.id);
      const flat = marker ? AreaMarkerSource.#flat(marker) : {};
      return { ...point, properties: { ...point.properties, ...flat, marker_rank: marker?.rank ?? 9999 } };
    });
    return { type: 'FeatureCollection', features };
  }

  // Only the fields a marker has, so `has` in the layer's expressions tells which text to draw.
  static #flat(marker: AreaMarker): Readonly<Record<string, string | boolean>> {
    const entries: [string, string | boolean | null][] = [
      ['marker_value', marker.value],
      ['marker_basis', marker.basis],
      ['marker_count', marker.count],
      ['marker_pilot', marker.pilot || null],
      ['marker_tooltip', marker.tooltip],
    ];
    return Object.fromEntries(entries.filter((entry): entry is [string, string | boolean] => Boolean(entry[1])));
  }

  /** Starts loading the points; an older load that finishes late is ignored. */
  load(): void {
    const request = ++this.#request;
    this.#points = null;
    this.#loader.labels().then(
      (points) => {
        if (request !== this.#request) return;
        this.#points = points;
        this.refresh();
      },
      (error: unknown) => console.error('Could not load the area markers', error),
    );
  }

  setMarkers(markers: ReadonlyMap<string, AreaMarker>): void {
    this.#markers = markers;
    this.refresh();
  }

  /** Writes the joined points into the source, if it is on the map. */
  refresh(): void {
    this.#map.getSource<GeoJSONSource>(this.#sourceId)?.setData(AreaMarkerSource.merge(this.#points, this.#markers));
  }
}
