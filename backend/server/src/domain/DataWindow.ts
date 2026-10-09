import type { WardScores } from "../contracts/index.gen.js";
import type { AreaSites } from "./AreaSites.js";
import { DAY_MS, isoSeconds } from "./scoreUtils.js";

// From the area's earliest real report to the run time; never starts earlier than the data does.
export class DataWindow {
  readonly from: string;
  readonly to: string;

  private constructor(from: string, to: string) {
    this.from = from;
    this.to = to;
  }

  static over(sites: AreaSites, now: Date): DataWindow {
    const to = isoSeconds(now);
    return new DataWindow(sites.earliestReport() ?? to, to);
  }

  get toMs(): number {
    return Date.parse(this.to);
  }

  days(): number {
    return Math.max(0, this.toMs - Date.parse(this.from)) / DAY_MS;
  }

  toJSON(): WardScores["data_window"] {
    return { from: this.from, to: this.to };
  }
}
