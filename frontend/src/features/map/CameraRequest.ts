import type { LonLat } from '../../domain/Site';

/** "Move the map to these points"; a new object each time, so asking twice moves twice. */
export interface CameraRequest {
  readonly points: readonly LonLat[];
}
