import { ValidationError } from "../../domain/errors.js";
import type { QueueMessage } from "../../domain/QueueMessage.js";
import type { Logger } from "../../ports/Logger.js";
import type { MessageHandler } from "../../ports/MessageHandler.js";
import type { VideoScanProcessor } from "../VideoScanProcessor.js";

const SCAN_ID = /^scn_[a-z0-9_]{1,40}$/;

// kind scan: cut the video into frame reports; on the last failed receive the scan fails with retries_exhausted.
export class ScanMessageHandler implements MessageHandler {
  readonly #processor: VideoScanProcessor;
  readonly #logger: Logger;

  constructor(processor: VideoScanProcessor, logger: Logger) {
    this.#processor = processor;
    this.#logger = logger;
  }

  async handle(message: QueueMessage): Promise<void> {
    const scanId = message.field("scan_id");
    if (typeof scanId !== "string" || !SCAN_ID.test(scanId)) {
      throw new ValidationError("scan message scan_id is missing or malformed");
    }
    try {
      await this.#processor.process(scanId);
    } catch (error) {
      if (message.isLastAttempt()) {
        await this.#exhaust(scanId, message.receiveCount);
      }
      throw error;
    }
  }

  async #exhaust(scanId: string, receiveCount: number): Promise<void> {
    try {
      await this.#processor.markExhausted(scanId);
      this.#logger.warn({ scan_id: scanId, receive_count: receiveCount }, "scan failed after the last attempt");
    } catch (error) {
      this.#logger.error({ scan_id: scanId, error }, "could not mark the scan failed");
    }
  }
}
