import { BatchGetCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { ExternalServiceError } from "../domain/errors.js";
import type { FrameOutcome } from "../domain/scout/ScanFindings.js";
import type { FrameOutcomeReader } from "../ports/FrameOutcomeReader.js";

const BATCH = 100;
const ATTEMPTS = 3;
type Key = Record<string, unknown>;

// BatchGetItem over the frame reports; a scan has at most 60, so one batch in practice.
export class DynamoFrameOutcomeReader implements FrameOutcomeReader {
  readonly #client: DynamoDBDocumentClient;
  readonly #table: string;

  constructor(client: DynamoDBDocumentClient, table: string) {
    this.#client = client;
    this.#table = table;
  }

  async outcomes(reportIds: readonly string[]): Promise<FrameOutcome[]> {
    const found: FrameOutcome[] = [];
    for (let start = 0; start < reportIds.length; start += BATCH) {
      const keys = reportIds.slice(start, start + BATCH).map((report_id) => ({ report_id }));
      found.push(...(await this.#batch(keys)));
    }
    return found;
  }

  // DynamoDB may hand back unprocessed keys under load; ask again a few times before giving up.
  async #batch(keys: readonly Key[]): Promise<FrameOutcome[]> {
    const items: FrameOutcome[] = [];
    let pending = [...keys];
    for (let attempt = 0; attempt < ATTEMPTS && pending.length > 0; attempt += 1) {
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
