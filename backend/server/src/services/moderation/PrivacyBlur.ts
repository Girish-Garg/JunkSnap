import type { BlurredPhoto } from "../../domain/moderation/BlurredPhoto.js";
import { BlurRecord } from "../../domain/moderation/BlurRecord.js";
import type { BlurRegion, Padding } from "../../domain/moderation/Box.js";
import type { LoadedPhoto } from "../../domain/moderation/LoadedPhoto.js";
import type { PhotoId } from "../../domain/moderation/PhotoId.js";
import type { Blurrer } from "../../ports/moderation/Blurrer.js";
import type { FaceFinder } from "../../ports/moderation/FaceFinder.js";
import type { ImageStore } from "../../ports/moderation/ImageStore.js";
import type { PlateFinder } from "../../ports/moderation/PlateFinder.js";

// Face boxes stop at the brow and chin, so 40% more also covers hair, ears and jaw.
export const FACE_PADDING: Padding = { fraction: 0.4, minPixels: 0 };
// OCR boxes hug the characters; at least 6 px or 30% more covers the plate's edge and any unread character.
export const PLATE_PADDING: Padding = { fraction: 0.3, minPixels: 6 };

export interface BlurPorts {
  readonly faces: FaceFinder;
  readonly plates: PlateFinder;
  readonly blurrer: Blurrer;
  readonly store: ImageStore;
}

// Blurs faces and number plates, and writes the only public copy of the photo.
export class PrivacyBlur {
  readonly #ports: BlurPorts;

  constructor(ports: BlurPorts) {
    this.#ports = ports;
  }

  async blur(photo: LoadedPhoto): Promise<BlurredPhoto> {
    const { faces, plates, blurrer } = this.#ports;
    const [foundFaces, foundPlates] = await Promise.all([faces.find(photo.upright), plates.find(photo.upright)]);
    const regions: BlurRegion[] = [
      ...foundFaces.boxes.map((box) => ({ box, padding: FACE_PADDING })),
      ...foundPlates.boxes.map((box) => ({ box, padding: PLATE_PADDING })),
    ];
    return { jpeg: await blurrer.obscure(photo.upright, regions), record: new BlurRecord(foundFaces, foundPlates) };
  }

  async publish(blurred: BlurredPhoto, photoId: PhotoId): Promise<void> {
    await this.#ports.store.writePublic(photoId.publicBlurredKey(), blurred.jpeg);
  }
}
