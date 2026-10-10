import { BlurPlanner } from "../../domain/moderation/BlurPlanner.js";
import type { BlurredPhoto } from "../../domain/moderation/BlurredPhoto.js";
import { BlurRecord } from "../../domain/moderation/BlurRecord.js";
import type { LoadedPhoto } from "../../domain/moderation/LoadedPhoto.js";
import type { PhotoId } from "../../domain/moderation/PhotoId.js";
import type { Blurrer } from "../../ports/moderation/Blurrer.js";
import type { FaceFinder } from "../../ports/moderation/FaceFinder.js";
import type { ImageStore } from "../../ports/moderation/ImageStore.js";
import type { PlateFinder } from "../../ports/moderation/PlateFinder.js";
import type { SubjectFinder } from "../../ports/moderation/SubjectFinder.js";

export { FACE_PADDING, PLATE_PADDING } from "../../domain/moderation/BlurPlanner.js";

export interface BlurPorts {
  readonly faces: FaceFinder;
  readonly plates: PlateFinder;
  readonly subjects: SubjectFinder;
  readonly blurrer: Blurrer;
  readonly store: ImageStore;
}

// Blurs faces, number plates and the people and vehicles they may hide in, and writes the only public copy.
export class PrivacyBlur {
  readonly #ports: BlurPorts;
  readonly #planner = new BlurPlanner();

  constructor(ports: BlurPorts) {
    this.#ports = ports;
  }

  async blur(photo: LoadedPhoto): Promise<BlurredPhoto> {
    const { faces, plates, subjects, blurrer } = this.#ports;
    const jpeg = photo.upright;
    const [foundFaces, foundPlates, foundSubjects] = await Promise.all([faces.find(jpeg), plates.find(jpeg), subjects.find(jpeg)]);
    const plan = this.#planner.plan({
      faces: foundFaces.boxes,
      textPlates: foundPlates.boxes,
      labelPlates: foundSubjects.plates,
      subjects: foundSubjects.subjects,
      brightness: photo.brightness,
    });
    const record = new BlurRecord({ faces: foundFaces, plates: foundPlates, subjects: foundSubjects }, plan);
    return { jpeg: await blurrer.obscure(jpeg, plan.regions), record };
  }

  async publish(blurred: BlurredPhoto, photoId: PhotoId): Promise<void> {
    await this.#ports.store.writePublic(photoId.publicBlurredKey(), blurred.jpeg);
  }
}
