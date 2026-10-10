import { DetectLabelsCommand, type Label, type RekognitionClient } from "@aws-sdk/client-rekognition";
import type { Box } from "../../domain/moderation/Box.js";
import type { FoundSubjects, Subject, SubjectKind } from "../../domain/moderation/Subject.js";
import type { SubjectFinder } from "../../ports/moderation/SubjectFinder.js";
import { callService, toBoxes } from "./utils.js";

const PLATE_LABEL = "License Plate";
const PLATE_MIN_CONFIDENCE = 50;
// Low on purpose: an unsure person or vehicle is still blurred, whole, rather than left out.
const MIN_CONFIDENCE = 40;
// Every name here is in Rekognition's label list (checked on 11 Oct 2026); an unknown name fails the whole call.
// Rekognition has no auto-rickshaw label; autos come back as Tricycle, Vehicle or Transportation.
const SUBJECT_KINDS: ReadonlyMap<string, SubjectKind> = new Map([
  ["Person", "person"],
  ...["Car", "Truck", "Bus", "Van", "Taxi", "Jeep", "Pickup Truck", "Minibus", "Tractor", "Sedan", "Vehicle", "Transportation"].map(
    (name): [string, SubjectKind] => [name, "vehicle"],
  ),
  ...["Motorcycle", "Scooter", "Moped", "Motor Scooter", "Bicycle", "Tricycle"].map((name): [string, SubjectKind] => [name, "two_wheeler"]),
]);

// One DetectLabels call: License Plate boxes, plus every person and vehicle instance that may carry a face or plate.
export class RekognitionSubjectFinder implements SubjectFinder {
  readonly #client: RekognitionClient;

  constructor(client: RekognitionClient) {
    this.#client = client;
  }

  async find(jpeg: Uint8Array): Promise<FoundSubjects> {
    const command = new DetectLabelsCommand({
      Image: { Bytes: jpeg },
      MinConfidence: MIN_CONFIDENCE,
      Features: ["GENERAL_LABELS"],
      Settings: { GeneralLabels: { LabelInclusionFilters: [PLATE_LABEL, ...SUBJECT_KINDS.keys()] } },
    });
    const response = await callService("Rekognition DetectLabels", () => this.#client.send(command));
    const labels = response.Labels ?? [];
    return {
      plates: labels.filter((label) => label.Name === PLATE_LABEL).flatMap((label) => this.#plates(label)),
      subjects: labels.flatMap((label) => this.#subjects(label)),
      model: "DetectLabels",
      version: response.LabelModelVersion ?? "unknown",
    };
  }

  #plates(label: Label): Box[] {
    return (label.Instances ?? [])
      .filter((instance) => (instance.Confidence ?? label.Confidence ?? 0) >= PLATE_MIN_CONFIDENCE)
      .flatMap((instance) => toBoxes(instance.BoundingBox));
  }

  #subjects(label: Label): Subject[] {
    const kind = SUBJECT_KINDS.get(label.Name ?? "");
    if (kind === undefined) {
      return [];
    }
    return (label.Instances ?? []).flatMap((instance) =>
      toBoxes(instance.BoundingBox).map((box) => ({ kind, box, confidence: instance.Confidence ?? label.Confidence ?? 0 })),
    );
  }
}
