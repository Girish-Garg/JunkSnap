import {
  DetectLabelsCommand,
  DetectTextCommand,
  type RekognitionClient,
  type TextDetection,
} from "@aws-sdk/client-rekognition";
import { PlateTextScanner, type TextLine, type TextWord } from "../../domain/moderation/PlateTextScanner.js";
import type { FoundRegions } from "../../domain/moderation/types.js";
import type { PlateFinder } from "../../ports/moderation/PlateFinder.js";
import { callService, toBoxes } from "./utils.js";

const PLATE_LABEL = "License Plate";
const PLATE_LABEL_MIN_CONFIDENCE = 50;

// Plates read as text, plus DetectLabels plate boxes that no text plate already covers.
export class RekognitionPlateFinder implements PlateFinder {
  readonly #client: RekognitionClient;
  readonly #scanner = new PlateTextScanner();

  constructor(client: RekognitionClient) {
    this.#client = client;
  }

  async find(jpeg: Uint8Array): Promise<FoundRegions> {
    const [text, labels] = await Promise.all([this.#detectText(jpeg), this.#detectPlates(jpeg)]);
    const textPlates = this.#scanner.plateBoxes(this.#lines(text.TextDetections ?? []));
    const labelPlates = (labels.Labels ?? [])
      .flatMap((label) => (label.Instances ?? []).flatMap((instance) => toBoxes(instance.BoundingBox)))
      .filter((box) => !textPlates.some((plate) => plate.intersectionArea(box) > 0));
    return {
      boxes: [...textPlates, ...labelPlates],
      model: "DetectText+DetectLabels",
      version: `${text.TextModelVersion ?? "unknown"}+${labels.LabelModelVersion ?? "unknown"}`,
    };
  }

  #detectText(jpeg: Uint8Array) {
    const command = new DetectTextCommand({ Image: { Bytes: jpeg } });
    return callService("Rekognition DetectText", () => this.#client.send(command));
  }

  #detectPlates(jpeg: Uint8Array) {
    const command = new DetectLabelsCommand({
      Image: { Bytes: jpeg },
      MinConfidence: PLATE_LABEL_MIN_CONFIDENCE,
      Features: ["GENERAL_LABELS"],
      Settings: { GeneralLabels: { LabelInclusionFilters: [PLATE_LABEL] } },
    });
    return callService("Rekognition DetectLabels", () => this.#client.send(command));
  }

  #lines(detections: readonly TextDetection[]): TextLine[] {
    const words = detections.filter((item) => item.Type === "WORD").sort((a, b) => (a.Id ?? 0) - (b.Id ?? 0));
    return detections
      .filter((item) => item.Type === "LINE")
      .flatMap((line) =>
        toBoxes(line.Geometry?.BoundingBox).map((box) => ({
          text: line.DetectedText ?? "",
          box,
          words: this.#words(words.filter((word) => word.ParentId === line.Id)),
        })),
      );
  }

  #words(detections: readonly TextDetection[]): TextWord[] {
    return detections.flatMap((item) => toBoxes(item.Geometry?.BoundingBox).map((box) => ({ text: item.DetectedText ?? "", box })));
  }
}
