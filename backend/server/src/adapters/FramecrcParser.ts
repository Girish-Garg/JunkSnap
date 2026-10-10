import type { VideoInfo } from "../ports/VideoFrameReader.js";

const TIME_BASE = /^#tb 0: (\d+)\/(\d+)/m;
const DIMENSIONS = /^#dimensions 0: (\d+)x(\d+)/m;
// Packet lines are "stream, dts, pts, duration, size, hash".
const PACKET_PTS = /^0,\s*-?\d+,\s*(-?\d+),/gm;
const MS_PER_SECOND = 1_000;

// Reads ffmpeg's framecrc listing of one video stream: size from the header, timing from every packet.
export class FramecrcParser {
  parse(listing: string): VideoInfo | undefined {
    const timeBase = TIME_BASE.exec(listing);
    const size = DIMENSIONS.exec(listing);
    const lastPts = FramecrcParser.#lastPts(listing);
    if (timeBase === null || size === null || lastPts === undefined) {
      return undefined;
    }
    const lastFrameMs = Math.floor((lastPts * Number(timeBase[1]) * MS_PER_SECOND) / Number(timeBase[2]));
    return { width: Number(size[1]), height: Number(size[2]), lastFrameMs };
  }

  // The largest pts, not the last line's: with B-frames, packets arrive out of display order.
  static #lastPts(listing: string): number | undefined {
    let last: number | undefined;
    for (const match of listing.matchAll(PACKET_PTS)) {
      const pts = Number(match[1]);
      last = last === undefined ? pts : Math.max(last, pts);
    }
    return last;
  }
}
