import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { describe, expect, it } from "vitest";
import { DynamoDeviceRegistry } from "../../src/adapters/moderation/DynamoDeviceRegistry.js";
import { ExternalServiceError, InternalDataError } from "../../src/domain/errors.js";
import { ScriptedClient } from "../sites/ScriptedClient.js";

const TABLES = { reports: "junksnap-dev-reports", devices: "junksnap-dev-devices", users: "junksnap-dev-users" };
const DEVICE = { kind: "device" as const, id: "3f6c2a1e-8b4d-4c7a-9e21-5d0b7f3a6c14" };
const USER = { kind: "user" as const, id: "5e2b8c41-7a3d-4f19-b6e0-93c1d2a4f8b7" };

const registry = (client: ScriptedClient) => new DynamoDeviceRegistry(client.as<DynamoDBDocumentClient>(), TABLES);

describe("DynamoDeviceRegistry", () => {
  it("counts Snap photos over the window to the second, both ends included, and pages to the end", async () => {
    const client = new ScriptedClient([() => ({ Count: 2, LastEvaluatedKey: { k: 1 } }), () => ({ Count: 1 })]);
    const window = { sender: USER, from: new Date("2026-10-10T01:14:52.400Z"), to: new Date("2026-10-10T02:14:52.900Z") };
    expect(await registry(client).snapPhotos(window)).toBe(3);
    expect(client.sent[0]?.input).toMatchObject({
      TableName: TABLES.reports,
      IndexName: "by-user",
      KeyConditionExpression: "#key = :key AND received_at BETWEEN :from AND :to",
      FilterExpression: "capture_mode = :snap",
      ExpressionAttributeNames: { "#key": "user_id" },
      ExpressionAttributeValues: { ":key": USER.id, ":from": "2026-10-10T01:14:52Z", ":to": "2026-10-10T02:14:52Z", ":snap": "snap" },
      Select: "COUNT",
    });
    expect(client.sent[1]?.input).toMatchObject({ IndexName: "by-user", ExclusiveStartKey: { k: 1 } });
  });

  it("reads a known device's standing and treats a missing row as new", async () => {
    const client = new ScriptedClient([() => ({ Item: { reputation: 0.74, blocked: true } }), () => ({})]);
    expect(await registry(client).standing(DEVICE)).toEqual({ known: true, reputation: 0.74, blocked: true });
    expect(await registry(client).standing(USER)).toEqual({ known: false, reputation: 0.5, blocked: false });
    expect(client.sent.map((sent) => sent.input)).toEqual([
      { TableName: TABLES.devices, Key: { device_token: DEVICE.id } },
      { TableName: TABLES.users, Key: { user_id: USER.id } },
    ]);
  });

  it("refuses a stored reputation outside 0 to 1 and wraps SDK failures", async () => {
    await expect(registry(new ScriptedClient([() => ({ Item: { reputation: 3 } })])).standing(DEVICE)).rejects.toThrow(InternalDataError);
    const failing = new ScriptedClient([], () => {
      throw new Error("throttled");
    });
    await expect(registry(failing).standing(DEVICE)).rejects.toThrow(ExternalServiceError);
  });
});
