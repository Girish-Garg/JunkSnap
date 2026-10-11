import type { GetCommand, GetCommandOutput } from "@aws-sdk/lib-dynamodb";
import { describe, expect, it } from "vitest";
import { DynamoSiteReader, type SiteGetter } from "../../src/adapters/letters/DynamoSiteReader.js";
import { downWriter, DEVICE, letterService, siteFixture, USER } from "./support.js";

type Item = Record<string, unknown>;

const jodhpur = siteFixture("jdh-1");

// A sites row written before decision 20261010-1530: no backers, and the old community_check verification.
function legacyRow(verification: string): Item {
  const [lon, lat] = jodhpur.geometry.coordinates;
  const row: Item = { ...jodhpur.properties, verification, lat, lon, geohash4: "tsj9", reporter_ids: ["u1", "u2"] };
  delete row.backers;
  return row;
}

class OneRowTable implements SiteGetter {
  readonly #item: Item;

  constructor(item: Item) {
    this.#item = item;
  }

  async send(command: GetCommand): Promise<GetCommandOutput> {
    return { $metadata: {}, Item: command.input.Key?.site_id === this.#item.site_id ? this.#item : undefined };
  }
}

describe("DynamoSiteReader with rows from before backers", () => {
  it("reads a row without backers as the new shape instead of failing the letter", async () => {
    const site = await new DynamoSiteReader(new OneRowTable(legacyRow("verified")), "junksnap-dev-sites").find("site_jdh_1");
    const photoPeople = Math.max(2, jodhpur.properties.reporters ?? 1);
    expect(site?.properties.backers).toEqual({ count: photoPeople, needed: 10, photo_people: photoPeople, vote_people: 0 });
    expect(site?.properties.verification).toBe("verified");
  });

  it("reads community_check as unverified", async () => {
    const site = await new DynamoSiteReader(new OneRowTable(legacyRow("community_check")), "t").find("site_jdh_1");
    expect(site?.properties.verification).toBe("unverified");
  });

  it("drafts a letter for a verified legacy row", async () => {
    const site = await new DynamoSiteReader(new OneRowTable(legacyRow("verified")), "t").find("site_jdh_1");
    const service = await letterService({ sites: site === null ? [] : [site], writer: downWriter() });
    const letter = await service.draft({ siteId: "site_jdh_1", channel: "local_body", language: "en", requester: { deviceToken: DEVICE, userId: USER } });
    expect(letter.site_id).toBe("site_jdh_1");
  });
});
