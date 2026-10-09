import { GetCommand, PutCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { ExternalServiceError, InternalDataError } from "../domain/errors.js";
import { Report } from "../domain/Report.js";
import { ReportId } from "../domain/ReportId.js";
import type { ReportRecord } from "../domain/ReportRecord.js";
import type { ReportRepository } from "../ports/ReportRepository.js";

const CONDITION_FAILED = "ConditionalCheckFailedException";

// The document client must drop undefined values, so absent fields stay absent and sparse GSIs work.
export class DynamoReportRepository implements ReportRepository {
  readonly #client: DynamoDBDocumentClient;
  readonly #table: string;

  constructor(client: DynamoDBDocumentClient, table: string) {
    this.#client = client;
    this.#table = table;
  }

  async get(reportId: string): Promise<Report | undefined> {
    const command = new GetCommand({ TableName: this.#table, Key: { report_id: reportId }, ConsistentRead: true });
    const output = await this.#call("read", () => this.#client.send(command));
    return output.Item === undefined ? undefined : Report.fromRecord(DynamoReportRepository.#record(output.Item));
  }

  async create(report: Report): Promise<boolean> {
    const condition = "attribute_not_exists(report_id)";
    const command = new PutCommand({ TableName: this.#table, Item: report.toRecord(), ConditionExpression: condition });
    try {
      await this.#client.send(command);
      return true;
    } catch (error) {
      if (error instanceof Error && error.name === CONDITION_FAILED) {
        return false;
      }
      throw new ExternalServiceError(`Could not create report ${report.id}`, { cause: error });
    }
  }

  async save(report: Report): Promise<void> {
    const command = new PutCommand({ TableName: this.#table, Item: report.toRecord() });
    await this.#call("save", () => this.#client.send(command));
  }

  async #call<T>(action: string, send: () => Promise<T>): Promise<T> {
    try {
      return await send();
    } catch (error) {
      throw new ExternalServiceError(`Could not ${action} a report in ${this.#table}`, { cause: error });
    }
  }

  static #record(item: Record<string, unknown>): ReportRecord {
    const valid = ReportId.isValid(item.report_id) && typeof item.status === "string" && Array.isArray(item.completed_steps);
    if (!valid) {
      throw new InternalDataError(`reports item ${String(item.report_id)} is malformed`);
    }
    return item as unknown as ReportRecord;
  }
}
