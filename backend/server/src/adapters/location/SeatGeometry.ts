// GeoJSON [lon, lat, ...]; structurally the geojson Polygon and MultiPolygon types turf accepts.
export type Position = [number, number, ...number[]];

export type SeatGeometry =
  | { type: "Polygon"; coordinates: Position[][] }
  | { type: "MultiPolygon"; coordinates: Position[][][] };

export interface Shape<T> {
  readonly geometry: SeatGeometry;
  readonly value: T;
}
