// Reviewed ward-record facts for one area; null or empty means not known, never zero.
export interface AreaFactSheet {
  readonly areaKm2: number | null;
  // The area's city has crawled school or water map layers, so an empty site.insights.near means none nearby.
  readonly placesMapped: boolean;
}
