import type { Box } from "./Box.js";
import { GateVerdict } from "./GateVerdict.js";
import type { ModelStamp } from "./types.js";
import { unique } from "./utils.js";

// `category` is the label's top-level DetectModerationLabels category.
export interface ModerationLabel {
  readonly name: string;
  readonly category: string;
}

export interface LabeledBox {
  readonly label: string;
  readonly box: Box;
}

export interface ImageScreening {
  readonly moderationLabels: readonly ModerationLabel[];
  readonly people: readonly Box[];
  readonly stamp: ModelStamp;
}

// Visually Disturbing stays allowed: dead animals are common at dumps. Old names cover moderation model 6.
const REJECTED_CATEGORIES: ReadonlySet<string> = new Set(["Explicit", "Explicit Nudity", "Violence", "Graphic Violence"]);
export const PERSON_LABEL = "Person";
// Share of the smaller box covered by the other, above which a person counts as handling the waste.
const DUMPING_OVERLAP = 0.2;

export class GatePolicy {
  unsafe(screening: ImageScreening): GateVerdict {
    const unsafe = screening.moderationLabels.filter((label) => REJECTED_CATEGORIES.has(label.category));
    if (unsafe.length > 0) {
      return GateVerdict.fail("unsafe_image", unique(unsafe.map((label) => label.name)), screening.stamp);
    }
    return GateVerdict.pass(screening.stamp);
  }

  // Needs waste boxes from a WasteLocator; a person near a heap without a box is never enough.
  dumping(screening: ImageScreening, waste: readonly LabeledBox[]): GateVerdict {
    const dumped = waste.filter((item) =>
      screening.people.some((person) => person.overlapOfSmaller(item.box) >= DUMPING_OVERLAP),
    );
    if (dumped.length > 0) {
      return GateVerdict.fail("person_dumping", unique([PERSON_LABEL, ...dumped.map((item) => item.label)]), screening.stamp);
    }
    return GateVerdict.pass(screening.stamp);
  }
}
