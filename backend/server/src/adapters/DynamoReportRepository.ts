import { GetCommand, PutCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { ConcurrentUpdateError } from "../domain/ConcurrentUpdateError.js";
import { ExternalServiceError, InternalDataError } from "../domain/errors.js";
import { Report } from "../domain/Report.js";
import { ReportId } from "../domain/ReportId.js";
import type { ReportRecord } from "../domain/ReportRecord.js";
import type { ReportRepository } from "../ports/ReportRepository.js";

const CONDITION_FAILED = "ConditionalCheckFailedException";
const VERSION_NAMES = { "#version": "version" };

interface PutCondition {
  readonly ConditionExpression: string;
  readonly ExpressionAttributeNames?: Record<string, string>;
  readonly ExpressionAttributeValues?: Record<string, unknown>;
}

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
    let item: Record<string, unknown> | undefined;
    try {
      item = (await this.#client.send(command)).Item;
    } catch (error) {
      throw new ExternalServiceError(`Could not read a report in ${this.#table}`, { cause: error });
    }
    return item === undefined ? undefined : Report.fromRecord(DynamoReportRepository.#record(item));
  }

  create(report: Report): Promise<boolean> {
    return this.#put(report, { ConditionExpression: "attribute_not_exists(report_id)" });
  }

  async save(report: Report): Promise<void> {
    const expected = report.version;
    const condition: PutCondition =
      expected === 0
        ? { ConditionExpression: "attribute_not_exists(#version)", ExpressionAttributeNames: VERSION_NAMES }
        : {
            ConditionExpression: "#version = :expected",
            ExpressionAttributeNames: VERSION_NAMES,
            ExpressionAttributeValues: { ":expected": expected },
          };
    if (!(await this.#put(report, condition))) {
      throw new ConcurrentUpdateError(`report ${report.id} changed since it was read`);
    }
  }

  // Writes version + 1; false when the condition failed.
  async #put(report: Report, condition: PutCondition): Promise<boolean> {
    const item = { ...report.toRecord(), version: report.version + 1 };
    try {
      await this.#client.send(new PutCommand({ TableName: this.#table, Item: item, ...condition }));
    } catch (error) {
      if (error instanceof Error && error.name === CONDITION_FAILED) {
        return false;
      }
      throw new ExternalServiceError(`Could not write report ${report.id} to ${this.#table}`, { cause: error });
    }
    report.advanceVersion();
    return true;
  }

  static #record(item: Record<string, unknown>): ReportRecord {
    const valid = ReportId.isValid(item.report_id) && typeof item.status === "string" && Array.isArray(item.completed_steps);
    if (!valid) {
      throw new InternalDataError(`reports item ${String(item.report_id)} is malformed`);
    }
    return item as unknown as ReportRecord;
  }
}
