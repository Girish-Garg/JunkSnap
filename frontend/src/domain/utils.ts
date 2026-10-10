import type { LonLat } from './Site';

const EARTH_RADIUS_M = 6_371_000;

/** Great-circle distance in metres (haversine). */
export function metresBetween([lon1, lat1]: LonLat, [lon2, lat2]: LonLat): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}
