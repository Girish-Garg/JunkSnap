import { CleanupJob } from "../domain/CleanupJob.js";
import type { QueueMessage } from "../domain/QueueMessage.js";
import type { CleanupModerator } from "../ports/CleanupModerator.js";
import type { CleanupRecorder } from "../ports/CleanupRecorder.js";
import type { Logger } from "../ports/Logger.js";
import type { MessageHandler } from "../ports/MessageHandler.js";
import type { MlVerifyClient } from "../ports/MlVerifyClient.js";
import type { ReporterReputation } from "./ReporterReputation.js";

export interface CleanupPorts {
  readonly moderator: CleanupModerator;
  readonly verifier: MlVerifyClient;
  readonly recorder: CleanupRecorder;
  readonly reputation: ReporterReputation;
  readonly logger: Logger;
}

// Moderate, then verify with purpose cleanup; the recorder decides acceptance and ignores repeats.
export class CleanupPipeline implements MessageHandler {
  readonly #ports: CleanupPorts;

  constructor(ports: CleanupPorts) {
    this.#ports = ports;
  }

  async handle(message: QueueMessage): Promise<void> {
    const job = CleanupJob.fromMessage(message);
    try {
      await this.#process(job);
    } catch (error) {
      await this.#giveUpOnLastAttempt(job, message);
      throw error;
    }
  }

  async #process(job: CleanupJob): Promise<void> {
    const { moderator, verifier, recorder, reputation: reputations } = this.#ports;
    const moderation = await moderator.moderate(job);
    if (moderation.outcome === "rejected") {
      await recorder.settle(job, { moderation, verification: null });
      return;
    }
    const [site, reputation] = await Promise.all([
      recorder.siteKind(job.data.site_id),
      reputations.of(job.reporter()),
    ]);
    const verification = await verifier.verify(job.verifyRequest(site, reputation));
    await recorder.settle(job, { moderation, verification });
  }

  async #giveUpOnLastAttempt(job: CleanupJob, message: QueueMessage): Promise<void> {
    if (!message.isLastAttempt()) {
      return;
    }
    const fields = { cleanup_id: job.id, receive_count: message.receiveCount };
    try {
      await this.#ports.recorder.giveUp(job);
      this.#ports.logger.warn(fields, "cleanup rejected after the last attempt");
    } catch (error) {
      this.#ports.logger.error({ ...fields, error }, "could not reject the cleanup");
    }
  }
}
