import type { BlurRegion, Box, Padding } from "./Box.js";
import type { Subject, SubjectKind } from "./Subject.js";

// Face boxes stop at the brow and chin, so 40% more also covers hair, ears and jaw.
export const FACE_PADDING: Padding = { fraction: 0.4, minPixels: 0 };
// OCR boxes hug the characters; at least 6 px or 30% more covers the plate's edge and any unread character.
export const PLATE_PADDING: Padding = { fraction: 0.3, minPixels: 6 };
// Head and plate zones are estimates, so they get a wide margin.
export const ZONE_PADDING: Padding = { fraction: 0.2, minPixels: 6 };
export const WHOLE_PADDING: Padding = { fraction: 0.1, minPixels: 6 };
// Stored with every public copy; the re-blur script skips copies already made under this policy.
export const BLUR_POLICY = "subjects-1";

// Mean grey level (0 to 1) below which a found-nothing answer from DetectFaces or DetectText is not trusted.
const DARK_BELOW = 0.3;
// DetectLabels instance confidence (percent) below which a person or vehicle is blurred whole.
const UNSURE_BELOW = 70;
// A box shorter than this share of the image height is blurred whole: its head or plate zone would be a guess.
const SMALL_BELOW = 0.2;
// The head is the top quarter of a standing person's box.
const HEAD_SHARE = 0.25;
// A person box wider than this share of its height (in pixels) is someone bent over, crouching or lying down,
// whose head may be anywhere in the box, so it is blurred whole.
const STANDING_MAX_WIDTH = 0.7;
// Where a plate zone starts, as a share of the box height from its top. Front and back plates sit low on cars,
// trucks, buses and autos, and about mid height on two-wheelers; the zone is full width for angled views.
const PLATE_ZONE_FROM: Readonly<Record<Exclude<SubjectKind, "person">, number>> = { vehicle: 0.4, two_wheeler: 0.25 };

export type RegionKind = "faces" | "plates" | "heads" | "plate_zones" | "people" | "vehicles";
export type RegionCounts = Readonly<Record<RegionKind, number>>;

export interface BlurInput {
  readonly faces: readonly Box[];
  readonly textPlates: readonly Box[];
  readonly labelPlates: readonly Box[];
  readonly subjects: readonly Subject[];
  // Mean grey level of the photo, 0 to 1.
  readonly brightness: number;
  // Image width over height, to read box shapes in pixels.
  readonly aspect: number;
}

export interface BlurPlan {
  readonly regions: readonly BlurRegion[];
  readonly counts: RegionCounts;
  // True when the photo was too dark to trust the detectors, so every person and vehicle was blurred whole.
  readonly lowLight: boolean;
}

interface Planned {
  readonly kind: RegionKind;
  readonly region: BlurRegion;
}

// Never trusts "found nothing": a person without a found face loses the head, a vehicle without a found plate
// loses its plate zone, and a dark photo, an unsure detection or a small box is blurred whole.
export class BlurPlanner {
  plan(input: BlurInput): BlurPlan {
    const plates = [...input.textPlates, ...this.#uncovered(input.labelPlates, input.textPlates)];
    const lowLight = input.brightness < DARK_BELOW;
    const planned: Planned[] = [
      ...input.faces.map((box) => this.#planned("faces", box, FACE_PADDING)),
      ...plates.map((box) => this.#planned("plates", box, PLATE_PADDING)),
      ...input.subjects.flatMap((subject) => this.#cover(subject, input, subject.kind === "person" ? input.faces : plates)),
    ];
    return { regions: planned.map((item) => item.region), counts: this.#count(planned), lowLight };
  }

  // Label plates that no text plate already covers.
  #uncovered(labelPlates: readonly Box[], textPlates: readonly Box[]): Box[] {
    return labelPlates.filter((box) => !textPlates.some((plate) => plate.intersectionArea(box) > 0));
  }

  // A face or plate counts only when its centre is in this subject's own head band or plate zone, so a
  // neighbour's face or another vehicle's plate inside an overlapping box never stands in for it.
  #cover(subject: Subject, input: BlurInput, found: readonly Box[]): Planned[] {
    const { kind, box } = subject;
    if (this.#wholly(subject, input)) {
      return [this.#planned(kind === "person" ? "people" : "vehicles", box, WHOLE_PADDING)];
    }
    const zone = kind === "person" ? box.band(0, HEAD_SHARE) : box.band(PLATE_ZONE_FROM[kind], 1);
    if (found.some((other) => zone.holdsCentreOf(other))) {
      return [];
    }
    return [this.#planned(kind === "person" ? "heads" : "plate_zones", zone, ZONE_PADDING)];
  }

  // Dark photo, unsure detection, small box, or a person who is not upright.
  #wholly(subject: Subject, input: BlurInput): boolean {
    const { box } = subject;
    const lying = subject.kind === "person" && box.width * input.aspect > box.height * STANDING_MAX_WIDTH;
    return input.brightness < DARK_BELOW || subject.confidence < UNSURE_BELOW || box.height < SMALL_BELOW || lying;
  }

  #planned(kind: RegionKind, box: Box, padding: Padding): Planned {
    return { kind, region: { box, padding } };
  }

  #count(planned: readonly Planned[]): RegionCounts {
    const counts: Record<RegionKind, number> = { faces: 0, plates: 0, heads: 0, plate_zones: 0, people: 0, vehicles: 0 };
    for (const item of planned) {
      counts[item.kind] += 1;
    }
    return counts;
  }
}
