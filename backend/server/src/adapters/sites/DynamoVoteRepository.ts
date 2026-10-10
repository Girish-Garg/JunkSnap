import { PutCommand, QueryCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { InternalDataError } from "../../domain/errors.js";
import type { Vote } from "../../domain/sites/VoteTally.js";
import type { VoteRepository } from "../../ports/sites/VoteRepository.js";
import type { AwsCalls } from "./AwsCalls.js";

const StoredVote = z.object({
  site_id: z.string(),
  device_token: z.string(),
  user_id: z.string().optional(),
  vote: z.enum(["confirm", "reject"]),
  voted_at: z.string(),
});

// Key (site_id, device_token): a device's later vote overwrites its earlier one; user_id is left out for a guest.
export class DynamoVoteRepository implements VoteRepository {
  readonly #client: DynamoDBDocumentClient;
  readonly #table: string;
  readonly #calls: AwsCalls;

  constructor(client: DynamoDBDocumentClient, table: string, calls: AwsCalls) {
    this.#client = client;
    this.#table = table;
    this.#calls = calls;
  }

  async put(vote: Vote): Promise<void> {
    const Item = {
      site_id: vote.siteId,
      device_token: vote.deviceToken,
      ...(vote.userId === null ? {} : { user_id: vote.userId }),
      vote: vote.choice,
      voted_at: vote.votedAt,
    };
    await this.#calls.run("DynamoDB put vote", () => this.#client.send(new PutCommand({ TableName: this.#table, Item })));
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
      const page = await this.#calls.run("DynamoDB query votes", () => this.#client.send(request));
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
    const { site_id, device_token, user_id, vote, voted_at } = parsed.data;
    return { siteId: site_id, deviceToken: device_token, userId: user_id ?? null, choice: vote, votedAt: voted_at };
  }
}
