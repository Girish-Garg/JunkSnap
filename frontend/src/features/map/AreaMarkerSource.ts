import type { Feature, FeatureCollection } from 'geojson';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import type { BoundaryKind } from '../../domain/AreaListing';
import type { LabelPoints } from '../../services/BoundaryCatalog';
import type { AreaMarker } from './AreaMarkers';

export interface LabelLoader {
  labels(kind: BoundaryKind): Promise<LabelPoints>;
}

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

/** Keeps the marker source in step: the kind's marker points joined with each area's current value. */
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
      const value = marker?.value ? { marker_value: marker.value } : {};
      const basis = marker?.basis ? { marker_basis: marker.basis } : {};
      const tooltip = marker ? { marker_tooltip: marker.tooltip } : {};
      return { ...point, properties: { ...point.properties, ...value, ...basis, ...tooltip, marker_rank: marker?.rank ?? 9999 } };
    });
    return { type: 'FeatureCollection', features };
  }

  /** Starts loading a kind's points; an older load that finishes late is ignored. */
  load(kind: BoundaryKind): void {
    const request = ++this.#request;
    this.#points = null;
    this.#loader.labels(kind).then(
      (points) => {
        if (request !== this.#request) return;
        this.#points = points;
        this.refresh();
      },
      (error: unknown) => console.error(`Could not load ${kind} markers`, error),
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
