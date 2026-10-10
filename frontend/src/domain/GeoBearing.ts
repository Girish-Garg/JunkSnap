import type { LatLon } from './ReportUpload';
import { metresBetween } from './utils';

const EARTH_RADIUS_M = 6_371_000;
const RAD = Math.PI / 180;

/** Distances, compass bearings and offsets on a sphere; exact enough over a few hundred metres. */
export class GeoBearing {
  static metres(from: LatLon, to: LatLon): number {
    return metresBetween([from.lon, from.lat], [to.lon, to.lat]);
  }

  /** Initial bearing from `from` to `to`, in degrees clockwise from north, 0 up to 360. */
  static between(from: LatLon, to: LatLon): number {
    const lat1 = from.lat * RAD;
    const lat2 = to.lat * RAD;
    const dLon = (to.lon - from.lon) * RAD;
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    return (Math.atan2(y, x) / RAD + 360) % 360;
  }

  /** The point `metres` from `origin` along `bearing` degrees. */
  static offset(origin: LatLon, bearing: number, metres: number): LatLon {
    const angle = metres / EARTH_RADIUS_M;
    const theta = bearing * RAD;
    const lat1 = origin.lat * RAD;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angle) + Math.cos(lat1) * Math.sin(angle) * Math.cos(theta));
    const dLon = Math.atan2(Math.sin(theta) * Math.sin(angle) * Math.cos(lat1), Math.cos(angle) - Math.sin(lat1) * Math.sin(lat2));
    return { lat: lat2 / RAD, lon: origin.lon + dLon / RAD };
  }
}
