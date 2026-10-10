import type { LocationLookup } from "../contracts/index.gen.js";

export interface LatLon {
  readonly lat: number;
  readonly lon: number;
}

// Location task: state, district, local body, ward and seats for a point (the report's spot, decision 20261011-0400).
export interface ReportLocator {
  locate(point: LatLon): Promise<LocationLookup>;
}
