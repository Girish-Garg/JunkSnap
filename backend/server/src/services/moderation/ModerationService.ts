import type { ModerationResult } from "../../contracts/index.gen.js";
import type { AuthenticityReport } from "../../domain/moderation/AuthenticityReport.js";
import type { BlurRecord } from "../../domain/moderation/BlurRecord.js";
import { GatePolicy } from "../../domain/moderation/GatePolicy.js";
import { GateVerdict } from "../../domain/moderation/GateVerdict.js";
import type { LoadedPhoto } from "../../domain/moderation/LoadedPhoto.js";
import { ModerationRecord } from "../../domain/moderation/ModerationRecord.js";
import type { PerceptualHash } from "../../domain/moderation/PerceptualHash.js";
import type { PhotoSubmission } from "../../domain/moderation/PhotoSubmission.js";
import type { NoteVerdict } from "../../domain/moderation/types.js";
import type { Clock } from "../../ports/moderation/Clock.js";
import type { ImageModerator } from "../../ports/moderation/ImageModerator.js";
import type { NoteModerator } from "../../ports/moderation/NoteModerator.js";
import type { AuthenticityService } from "./AuthenticityService.js";
import type { PhotoLoader } from "./PhotoLoader.js";
import type { PrivacyBlur } from "./PrivacyBlur.js";

export interface ModerationSteps {
  readonly loader: PhotoLoader;
  readonly gate: ImageModerator;
  readonly blur: PrivacyBlur;
  readonly authenticity: AuthenticityService;
  readonly notes: NoteModerator;
  readonly clock: Clock;
}

interface ImageOutcome {
  readonly hash: PerceptualHash | null;
  readonly gate: GateVerdict;
  readonly blur: BlurRecord | null;
  readonly checks: AuthenticityReport;
}

const INVALID = "not run: the image is invalid";
const GATE_FAILED = "not run: the image failed the moderation gate";

// Gate, then blur, then the authenticity chain; only Rekognition ever sees the original.
export class ModerationService {
  readonly #steps: ModerationSteps;
  readonly #policy = new GatePolicy();

  constructor(steps: ModerationSteps) {
    this.#steps = steps;
  }

  async moderate(submission: PhotoSubmission): Promise<ModerationResult> {
    const [note, image] = await Promise.all([this.#reviewNote(submission.fields.note), this.#moderateImage(submission)]);
    const parts = { ...image, note, photoId: submission.photoId, moderatedAt: this.#steps.clock.now() };
    return new ModerationRecord(parts).toContract();
  }

  async #moderateImage(submission: PhotoSubmission): Promise<ImageOutcome> {
    const load = await this.#steps.loader.load(submission);
    if ("invalid" in load) {
      const checks = this.#steps.authenticity.skipAll(submission, INVALID);
      return { hash: null, gate: GateVerdict.invalidImage(load.invalid), blur: null, checks };
    }
    return this.#moderatePhoto(submission, load.photo);
  }

  async #moderatePhoto(submission: PhotoSubmission, photo: LoadedPhoto): Promise<ImageOutcome> {
    const gate = this.#policy.judge(await this.#steps.gate.screen(photo.detectorCopy));
    if (gate.failed) {
      return { hash: photo.hash, gate, blur: null, checks: this.#steps.authenticity.skipAll(submission, GATE_FAILED) };
    }
    const blur = await this.#steps.blur.apply(photo, submission.photoId);
    const checks = await this.#steps.authenticity.verify({ submission, hash: photo.hash });
    return { hash: photo.hash, gate, blur, checks };
  }

  async #reviewNote(note: string | null): Promise<NoteVerdict | null> {
    return note === null || note.trim() === "" ? null : this.#steps.notes.review(note);
  }
}
