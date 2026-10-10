import type { PublicMedia } from "../sites/PublicMedia.js";

// The reports row fields a scan's summary reads (nested ones as DynamoDB projects them).
export interface FrameOutcome {
  readonly report_id: string;
  readonly status: string;
  readonly report_type: string;
  readonly site_id?: string;
  readonly scan?: { readonly t_ms?: number };
  readonly moderation_result?: { readonly outcome?: string; readonly blurred_key?: string | null };
}

// added: in a verified site; waiting: on the map, waiting for neighbours; skipped: moderation stopped it (a repeat view, say).
export type FrameResult = "checking" | "added" | "waiting" | "not_waste" | "skipped" | "hidden" | "failed" | "withdrawn";

export interface FrameFinding {
  readonly report_id: string;
  readonly t_ms: number;
  readonly result: FrameResult;
  readonly report_type: string;
  readonly site_id: string | null;
  readonly blurred_url: string | null;
}

// GET /scans/{id} found (contracts v1.10). Only frames the models passed count; sites are counted once each.
export interface ScanFound {
  readonly sites: number;
  readonly by_type: Readonly<Record<string, number>>;
  readonly checking: number;
  readonly frames: readonly FrameFinding[];
}

const RESULTS: Readonly<Record<string, FrameResult>> = {
  queued: "checking",
  processing: "checking",
  verified: "added",
  unverified: "waiting",
  community_check: "waiting",
  needs_review: "failed",
  withdrawn: "withdrawn",
  // A frame is never asked (an unsure judge rejects it, contracts v1.16); these only guard a row written otherwise.
  needs_confirmation: "not_waste",
  not_confirmed: "not_waste",
};
const ON_MAP: ReadonlySet<FrameResult> = new Set(["added", "waiting"]);

export class ScanFindings {
  readonly #media: PublicMedia;

  constructor(media: PublicMedia) {
    this.#media = media;
  }

  of(outcomes: readonly FrameOutcome[]): ScanFound {
    const frames = outcomes.map((outcome) => this.#finding(outcome)).sort((a, b) => a.t_ms - b.t_ms);
    const siteTypes = new Map<string, string>();
    for (const frame of frames.filter((candidate) => ON_MAP.has(candidate.result) && candidate.site_id !== null)) {
      siteTypes.set(frame.site_id ?? "", frame.report_type);
    }
    const byType: Record<string, number> = {};
    for (const type of siteTypes.values()) {
      byType[type] = (byType[type] ?? 0) + 1;
    }
    const checking = frames.filter((frame) => frame.result === "checking").length;
    return { sites: siteTypes.size, by_type: byType, checking, frames };
  }

  #finding(outcome: FrameOutcome): FrameFinding {
    const key = outcome.moderation_result?.blurred_key ?? null;
    return {
      report_id: outcome.report_id,
      t_ms: outcome.scan?.t_ms ?? 0,
      result: ScanFindings.#result(outcome),
      report_type: outcome.report_type,
      site_id: outcome.site_id ?? null,
      blurred_url: key === null ? null : this.#media.urlFor(key),
    };
  }

  // A rejected frame was stopped by moderation, by the models, or later hidden with its site by neighbours.
  static #result({ status, site_id, moderation_result }: FrameOutcome): FrameResult {
    if (status !== "rejected") {
      return RESULTS[status] ?? "checking";
    }
    if (site_id !== undefined) {
      return "hidden";
    }
    return moderation_result?.outcome === "rejected" ? "skipped" : "not_waste";
  }
}
