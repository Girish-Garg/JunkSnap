import { BatchGetCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { ExternalServiceError } from "../domain/errors.js";
import type { FrameOutcome } from "../domain/scout/ScanFindings.js";
import type { FrameOutcomeReader } from "../ports/FrameOutcomeReader.js";

type Key = Record<string, unknown>;

// BATCH_GET_SIZE keys per call (at most 100), and BATCH_READ_ATTEMPTS calls for keys DynamoDB left unprocessed.
export interface BatchReads {
  readonly size: number;
  readonly attempts: number;
}

// BatchGetItem over the frame reports; a scan has at most 60, so one batch in practice.
export class DynamoFrameOutcomeReader implements FrameOutcomeReader {
  readonly #client: DynamoDBDocumentClient;
  readonly #table: string;
  readonly #reads: BatchReads;

  constructor(client: DynamoDBDocumentClient, table: string, batch: BatchReads) {
    this.#client = client;
    this.#table = table;
    this.#reads = batch;
  }

  async outcomes(reportIds: readonly string[]): Promise<FrameOutcome[]> {
    const found: FrameOutcome[] = [];
    const { size } = this.#reads;
    for (let start = 0; start < reportIds.length; start += size) {
      const keys = reportIds.slice(start, start + size).map((report_id) => ({ report_id }));
      found.push(...(await this.#batch(keys)));
    }
    return found;
  }

  // DynamoDB may hand back unprocessed keys under load; ask again a few times before giving up.
  async #batch(keys: readonly Key[]): Promise<FrameOutcome[]> {
    const items: FrameOutcome[] = [];
    let pending = [...keys];
    for (let attempt = 0; attempt < this.#reads.attempts && pending.length > 0; attempt += 1) {
      const answer = await this.#send(pending);
      items.push(...this.#rows(answer.Responses));
      pending = this.#unprocessed(answer.UnprocessedKeys);
    }
    if (pending.length > 0) {
      throw new ExternalServiceError(`Could not read ${pending.length} frame reports from ${this.#table}`);
    }
    return items;
  }

  #rows(responses: Record<string, Key[]> | undefined): FrameOutcome[] {
    return (responses?.[this.#table] ?? []) as unknown as FrameOutcome[];
  }

  #unprocessed(unprocessed: Record<string, { Keys?: Key[] }> | undefined): Key[] {
    return unprocessed?.[this.#table]?.Keys ?? [];
  }

  async #send(keys: readonly Key[]) {
    const projection = {
      ProjectionExpression: "report_id, #status, report_type, site_id, #scan.t_ms, moderation_result.outcome, moderation_result.blurred_key",
      ExpressionAttributeNames: { "#status": "status", "#scan": "scan" },
    };
    const command = new BatchGetCommand({ RequestItems: { [this.#table]: { Keys: [...keys], ...projection } } });
    try {
      return await this.#client.send(command);
    } catch (error) {
      throw new ExternalServiceError(`Could not read frame reports from ${this.#table}`, { cause: error });
    }
  }
}
