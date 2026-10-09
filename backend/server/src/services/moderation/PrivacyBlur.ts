import { BlurRecord } from "../../domain/moderation/BlurRecord.js";
import type { LoadedPhoto } from "../../domain/moderation/LoadedPhoto.js";
import type { PhotoId } from "../../domain/moderation/PhotoId.js";
import type { Blurrer } from "../../ports/moderation/Blurrer.js";
import type { FaceFinder } from "../../ports/moderation/FaceFinder.js";
import type { ImageStore } from "../../ports/moderation/ImageStore.js";
import type { PlateFinder } from "../../ports/moderation/PlateFinder.js";

// Detector boxes are tight; growing them also covers hair, chins and plate frames.
const GROWTH = 0.15;

export interface BlurPorts {
  readonly faces: FaceFinder;
  readonly plates: PlateFinder;
  readonly blurrer: Blurrer;
  readonly store: ImageStore;
}

// Blurs faces and number plates and writes the only public copy of the photo.
export class PrivacyBlur {
  readonly #ports: BlurPorts;

  constructor(ports: BlurPorts) {
    this.#ports = ports;
  }

  async apply(photo: LoadedPhoto, photoId: PhotoId): Promise<BlurRecord> {
    const { faces, plates, blurrer, store } = this.#ports;
    const [foundFaces, foundPlates] = await Promise.all([faces.find(photo.detectorCopy), plates.find(photo.detectorCopy)]);
    const boxes = [...foundFaces.boxes, ...foundPlates.boxes].map((box) => box.grow(GROWTH));
    await store.writePublic(photoId.publicBlurredKey(), await blurrer.obscure(photo.original, boxes));
    return new BlurRecord(foundFaces, foundPlates);
  }
}
