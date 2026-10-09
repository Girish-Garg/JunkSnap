import {
  type DynamoDBDocumentClient,
  QueryCommand,
  type QueryCommandInput,
  ScanCommand,
  type ScanCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { InternalDataError } from "../../domain/errors.js";
import { callService } from "./utils.js";

export type Row = Record<string, unknown>;

interface Page {
  readonly Items?: Row[];
  readonly LastEvaluatedKey?: Row;
}

// Reads every page of a query or scan, and turns unreadable stored rows into InternalDataError.
export class DynamoReader {
  readonly #client: DynamoDBDocumentClient;

  constructor(client: DynamoDBDocumentClient) {
    this.#client = client;
  }

  query(input: QueryCommandInput): Promise<Row[]> {
    const what = `DynamoDB query ${input.IndexName ?? input.TableName ?? ""}`;
    return this.#pages(what, (start) => this.#client.send(new QueryCommand({ ...input, ExclusiveStartKey: start })));
  }

  scan(input: ScanCommandInput): Promise<Row[]> {
    const what = `DynamoDB scan ${input.TableName ?? ""}`;
    return this.#pages(what, (start) => this.#client.send(new ScanCommand({ ...input, ExclusiveStartKey: start })));
  }

  parse<T>(shape: z.ZodType<T>, row: Row, kind: string): T {
    const parsed = shape.safeParse(row);
    if (!parsed.success) {
      throw new InternalDataError(`unreadable ${kind} row in the duplicate index: ${z.prettifyError(parsed.error)}`);
    }
    return parsed.data;
  }

  async #pages(what: string, fetch: (start: Row | undefined) => Promise<Page>): Promise<Row[]> {
    const rows: Row[] = [];
    let start: Row | undefined;
    do {
      const page = await callService(what, () => fetch(start));
      rows.push(...(page.Items ?? []));
      start = page.LastEvaluatedKey;
    } while (start !== undefined);
    return rows;
  }
}
