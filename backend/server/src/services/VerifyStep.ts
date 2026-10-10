import type { Report } from "../domain/Report.js";
import type { MlVerifyClient } from "../ports/MlVerifyClient.js";
import type { NearbyVerifiedCounter } from "../ports/NearbyVerifiedCounter.js";
import type { PipelineStep } from "../ports/PipelineStep.js";
import type { ReporterReputation } from "./ReporterReputation.js";

// Sends the ML service only the blurred key; the decision maps to verified, community_check or rejected.
export class VerifyStep implements PipelineStep {
  readonly name = "verify";
  readonly #client: MlVerifyClient;
  readonly #reputation: ReporterReputation;
  readonly #nearby: NearbyVerifiedCounter;

  constructor(client: MlVerifyClient, reputation: ReporterReputation, nearby: NearbyVerifiedCounter) {
    this.#client = client;
    this.#reputation = reputation;
    this.#nearby = nearby;
  }

  async run(report: Report): Promise<void> {
    const record = report.toRecord();
    const [reputation, nearby] = await Promise.all([
      this.#reputation.of({ deviceToken: record.device_token, userId: record.user_id }),
      this.#nearby.count(record),
    ]);
    const request = report.verifyRequest({ reputation, nearby_verified_reports: nearby });
    report.recordVerification(await this.#client.verify(request));
  }
}
