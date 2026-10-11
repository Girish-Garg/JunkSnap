import { GeoPoint } from "../GeoPoint.js";
import type { LocatedFrame } from "../ScanFrame.js";

// Groups one scan's kept frames into spots: a frame joins the first spot whose first frame is within the radius.
// Frames of one spot and type merge into one site (contracts v1.10) unless an existing neighbour site takes the frame.
export class ScanSpots {
  readonly #radiusM: number;

  // radiusM: SCAN_SPOT_RADIUS_M.
  constructor(radiusM: number) {
    this.#radiusM = radiusM;
  }

  // The t_ms of each frame's spot (the spot's first frame), keyed by the frame's t_ms.
  assign(frames: readonly LocatedFrame[]): ReadonlyMap<number, number> {
    const anchors: { readonly tMs: number; readonly point: GeoPoint }[] = [];
    const spots = new Map<number, number>();
    for (const frame of frames.toSorted((a, b) => a.tMs - b.tMs)) {
      const point = new GeoPoint(frame.gps.lat, frame.gps.lon);
      let anchor = anchors.find((candidate) => candidate.point.distanceTo(point) <= this.#radiusM);
      if (anchor === undefined) {
        anchor = { tMs: frame.tMs, point };
        anchors.push(anchor);
      }
      spots.set(frame.tMs, anchor.tMs);
    }
    return spots;
  }
}
