import { DetectTextCommand, type RekognitionClient, type TextDetection } from "@aws-sdk/client-rekognition";
import { PlateTextScanner, type TextLine, type TextWord } from "../../domain/moderation/PlateTextScanner.js";
import type { FoundRegions } from "../../domain/moderation/types.js";
import type { PlateFinder } from "../../ports/moderation/PlateFinder.js";
import { callService, toBoxes } from "./utils.js";

// Plates read as text; License Plate label boxes come from RekognitionSubjectFinder.
export class RekognitionPlateFinder implements PlateFinder {
  readonly #client: RekognitionClient;
  readonly #scanner = new PlateTextScanner();

  constructor(client: RekognitionClient) {
    this.#client = client;
  }

  async find(jpeg: Uint8Array): Promise<FoundRegions> {
    const command = new DetectTextCommand({ Image: { Bytes: jpeg } });
    const text = await callService("Rekognition DetectText", () => this.#client.send(command));
    const boxes = this.#scanner.plateBoxes(this.#lines(text.TextDetections ?? []));
    return { boxes, model: "DetectText", version: text.TextModelVersion ?? "unknown" };
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
