import { PutCommand, QueryCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { InternalDataError } from "../../domain/errors.js";
import type { Vote } from "../../domain/sites/VoteTally.js";
import type { VoteRepository } from "../../ports/sites/VoteRepository.js";
import { awsCall } from "./utils.js";

const StoredVote = z.object({
  site_id: z.string(),
  device_token: z.string(),
  vote: z.enum(["confirm", "reject"]),
  weight: z.number().min(0),
  voted_at: z.string(),
});

// Key (site_id, device_token): a device's later vote overwrites its earlier one.
export class DynamoVoteRepository implements VoteRepository {
  readonly #client: DynamoDBDocumentClient;
  readonly #table: string;

  constructor(client: DynamoDBDocumentClient, table: string) {
    this.#client = client;
    this.#table = table;
  }

  async put(vote: Vote): Promise<void> {
    const Item = {
      site_id: vote.siteId,
      device_token: vote.deviceToken,
      vote: vote.choice,
      weight: vote.weight,
      voted_at: vote.votedAt,
    };
    await awsCall("DynamoDB put vote", () => this.#client.send(new PutCommand({ TableName: this.#table, Item })));
  }

  async forSite(siteId: string): Promise<Vote[]> {
    const votes: Vote[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const request = new QueryCommand({
        TableName: this.#table,
        KeyConditionExpression: "site_id = :site",
        ExpressionAttributeValues: { ":site": siteId },
        ConsistentRead: true,
        ExclusiveStartKey: startKey,
      });
      const page = await awsCall("DynamoDB query votes", () => this.#client.send(request));
      votes.push(...(page.Items ?? []).map(DynamoVoteRepository.#toVote));
      startKey = page.LastEvaluatedKey;
    } while (startKey !== undefined);
    return votes;
  }

  static #toVote(item: Record<string, unknown>): Vote {
    const parsed = StoredVote.safeParse(item);
    if (!parsed.success) {
      throw new InternalDataError(`malformed vote item: ${z.prettifyError(parsed.error)}`);
    }
    const { site_id, device_token, vote, weight, voted_at } = parsed.data;
    return { siteId: site_id, deviceToken: device_token, choice: vote, weight, votedAt: voted_at };
  }
}
