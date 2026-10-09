import {
  DetectLabelsCommand,
  DetectModerationLabelsCommand,
  type Label,
  type ModerationLabel as RekognitionLabel,
  type RekognitionClient,
} from "@aws-sdk/client-rekognition";
import type { Box } from "../../domain/moderation/Box.js";
import { type ImageScreening, type ModerationLabel, PERSON_LABEL } from "../../domain/moderation/GatePolicy.js";
import type { ImageModerator } from "../../ports/moderation/ImageModerator.js";
import { callService, toBoxes } from "./utils.js";

const MODERATION_MIN_CONFIDENCE = 60;
const LABEL_MIN_CONFIDENCE = 70;
// Moderation taxonomy depth in model 7.
const MAX_TAXONOMY_DEPTH = 3;

export class RekognitionImageModerator implements ImageModerator {
  readonly #client: RekognitionClient;

  constructor(client: RekognitionClient) {
    this.#client = client;
  }

  async screen(jpeg: Uint8Array): Promise<ImageScreening> {
    const [moderation, labels] = await Promise.all([this.#moderationLabels(jpeg), this.#sceneLabels(jpeg)]);
    const found = labels.Labels ?? [];
    return {
      moderationLabels: this.#categorise(moderation.ModerationLabels ?? []),
      people: this.#instances(found.filter((label) => label.Name === PERSON_LABEL)),
      stamp: {
        provider: "rekognition",
        model: "DetectModerationLabels+DetectLabels",
        version: `${moderation.ModerationModelVersion ?? "unknown"}+${labels.LabelModelVersion ?? "unknown"}`,
      },
    };
  }

  #moderationLabels(jpeg: Uint8Array) {
    const command = new DetectModerationLabelsCommand({ Image: { Bytes: jpeg }, MinConfidence: MODERATION_MIN_CONFIDENCE });
    return callService("Rekognition DetectModerationLabels", () => this.#client.send(command));
  }

  #sceneLabels(jpeg: Uint8Array) {
    const command = new DetectLabelsCommand({
      Image: { Bytes: jpeg },
      MinConfidence: LABEL_MIN_CONFIDENCE,
      Features: ["GENERAL_LABELS"],
      Settings: { GeneralLabels: { LabelInclusionFilters: [PERSON_LABEL] } },
    });
    return callService("Rekognition DetectLabels", () => this.#client.send(command));
  }

  #categorise(labels: readonly RekognitionLabel[]): ModerationLabel[] {
    const byName = new Map(labels.map((label) => [label.Name ?? "", label]));
    return labels.map((label) => ({ name: label.Name ?? "", category: this.#topCategory(label, byName) }));
  }

  // Walks ParentName up; a parent missing from the response is taken as the top level.
  #topCategory(label: RekognitionLabel, byName: ReadonlyMap<string, RekognitionLabel>): string {
    let current = label;
    for (let depth = 0; depth < MAX_TAXONOMY_DEPTH && current.ParentName; depth += 1) {
      const parent = byName.get(current.ParentName);
      if (parent === undefined) {
        return current.ParentName;
      }
      current = parent;
    }
    return current.Name ?? "";
  }

  #instances(labels: readonly Label[]): Box[] {
    return labels.flatMap((label) => (label.Instances ?? []).flatMap((instance) => toBoxes(instance.BoundingBox)));
  }
}
