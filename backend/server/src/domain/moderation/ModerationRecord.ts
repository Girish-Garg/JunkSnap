import type { ModerationResult } from "../../contracts/index.gen.js";
import type { AuthenticityReport } from "./AuthenticityReport.js";
import type { BlurRecord } from "./BlurRecord.js";
import type { GateVerdict } from "./GateVerdict.js";
import type { PerceptualHash } from "./PerceptualHash.js";
import type { PhotoId } from "./PhotoId.js";
import type { NoteVerdict, RejectReason } from "./types.js";

export interface ModerationParts {
  readonly photoId: PhotoId;
  // Null when the image could not be decoded.
  readonly hash: PerceptualHash | null;
  readonly gate: GateVerdict;
  // Null for a rejected photo: no public copy exists.
  readonly blur: BlurRecord | null;
  readonly checks: AuthenticityReport;
  readonly note: NoteVerdict | null;
  readonly moderatedAt: Date;
}

// The schema requires a pHash even for an undecodable image.
const NO_HASH = "0000000000000000";

// Assembles the moderation_result contract from the outcome of each step.
export class ModerationRecord {
  readonly #parts: ModerationParts;

  constructor(parts: ModerationParts) {
    this.#parts = parts;
  }

  reasons(): RejectReason[] {
    const reason = this.#parts.gate.reason ?? this.#parts.checks.reason;
    return reason === null ? [] : [reason];
  }

  toContract(): ModerationResult {
    const { photoId, gate, checks, note, moderatedAt } = this.#parts;
    const reasons = this.reasons();
    return {
      report_id: photoId.value,
      outcome: reasons.length > 0 ? "rejected" : "passed",
      reasons,
      ...this.#blurFields(),
      image_moderation: gate.toContract(),
      checks: checks.toContract(),
      phash: this.#parts.hash?.toHex() ?? NO_HASH,
      duplicate_of: checks.duplicateOf,
      note_moderation: note,
      moderated_at: moderatedAt.toISOString().replace(/\.\d{3}Z$/, "Z"),
    };
  }

  #blurFields(): Pick<ModerationResult, "blurred_key" | "blur"> {
    const { blur, photoId } = this.#parts;
    return blur === null ? { blurred_key: null, blur: null } : { blurred_key: photoId.publicBlurredKey(), blur: blur.toContract() };
  }
}
