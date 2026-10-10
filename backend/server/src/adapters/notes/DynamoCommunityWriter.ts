import { UpdateCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { ExternalServiceError } from "../../domain/errors.js";
import type { Community } from "../../domain/notes/Community.js";
import type { CommunityWriter } from "../../ports/notes/NoteStore.js";

type Client = Pick<DynamoDBDocumentClient, "send">;

// Writes site.community and bumps version, so a worker write that read the old item fails its version check and retries.
export class DynamoCommunityWriter implements CommunityWriter {
  readonly #client: Client;
  readonly #table: string;

  constructor(client: Client, table: string) {
    this.#client = client;
    this.#table = table;
  }

  async save(siteId: string, community: Community): Promise<void> {
    const command = new UpdateCommand({
      TableName: this.#table,
      Key: { site_id: siteId },
      UpdateExpression: "SET community = :community, version = if_not_exists(version, :zero) + :one",
      ConditionExpression: "attribute_exists(site_id)",
      ExpressionAttributeValues: { ":community": community, ":zero": 0, ":one": 1 },
    });
    try {
      await this.#client.send(command);
    } catch (error) {
      throw new ExternalServiceError(`Could not save the community summary of ${siteId}`, { cause: error });
    }
  }
}
