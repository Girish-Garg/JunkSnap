import { describe, expect, it } from "vitest";
import { Backers } from "../../src/domain/sites/Backers.js";
import { Site } from "../../src/domain/sites/Site.js";
import { VoteTally, type Vote } from "../../src/domain/sites/VoteTally.js";
import { DEVICE_A, DEVICE_B, report, userOf } from "./builders.js";

let clock = 0;
function vote(choice: Vote["choice"], person: { device?: string; user?: string | null } = {}): Vote {
  clock += 1;
  return {
    siteId: "site_jdh_1",
    deviceToken: person.device ?? `device-${clock}`,
    userId: person.user === undefined ? `user-${clock}` : person.user,
    choice,
    votedAt: new Date(Date.UTC(2026, 9, 10, 5, 0, clock)).toISOString(),
  };
}

const yes = (n: number) => Array.from({ length: n }, () => vote("confirm"));
const no = (n: number) => Array.from({ length: n }, () => vote("reject"));

function photos(site: Site, count: number): void {
  for (let n = 2; n < count + 2; n += 1) {
    site.merge(report({ id: `jdh_${n}`, device: `device-photo-${n}`, user: `user-photo-${n}` }));
  }
}

describe("VoteTally", () => {
  it("keeps one latest vote per person: the user id, else the device token", () => {
    const tally = VoteTally.of([
      vote("confirm", { device: "phone-1", user: "user-x" }),
      vote("reject", { device: "phone-2", user: "user-x" }),
      vote("confirm", { device: "guest-1", user: null }),
      vote("confirm", { device: "guest-1", user: null }),
    ]);
    expect(tally.yesPeople).toEqual(["guest-1"]);
    expect(tally.noPeople).toEqual(["user-x"]);
  });
});

describe("Backers", () => {
  it("counts a person with a photo and a yes vote once", () => {
    const backers = new Backers(["p1", "p2"], ["p2", "v1"], []);
    expect(backers.view(null)).toEqual({ count: 3, needed: 10, photo_people: 2, vote_people: 2 });
  });

  it("verifies at exactly 10 backers", () => {
    expect(new Backers(["p1"], ["v1", "v2", "v3", "v4", "v5", "v6", "v7", "v8"], []).outcome()).toBeNull();
    expect(new Backers(["p1"], ["v1", "v2", "v3", "v4", "v5", "v6", "v7", "v8", "v9"], []).outcome()).toBe("verified");
  });

  it("rejects when distinct no voters lead the backers by 3, ignoring a no from someone who sent a photo", () => {
    expect(new Backers(["p1"], [], ["n1", "n2", "n3"]).outcome()).toBeNull();
    expect(new Backers(["p1"], [], ["n1", "n2", "n3", "n4"]).outcome()).toBe("rejected");
    expect(new Backers(["p1"], [], ["p1", "n2", "n3", "n4"]).outcome()).toBeNull();
  });
});

describe("Site backers", () => {
  it("appears unverified as 1 of 10 from its first passed photo, even one the models were sure about", () => {
    const site = Site.found(report({ decision: "auto_verified" }));
    expect(site.toFeature().properties).toMatchObject({
      verification: "unverified",
      verified_count: 0,
      backers: { count: 1, needed: 10, photo_people: 1, vote_people: 0 },
    });
  });

  it("counts the same person's second photo once", () => {
    const site = Site.found(report());
    site.merge(report({ id: "jdh_2", device: DEVICE_A }));
    site.merge(report({ id: "jdh_3", device: DEVICE_B, user: userOf(DEVICE_A) }));
    expect(site.toFeature().properties.backers).toMatchObject({ count: 1, photo_people: 1 });
  });

  it("verifies with photos and yes votes from 10 different people, and then counts every report", () => {
    const site = Site.found(report());
    photos(site, 3);
    site.recordVotes(VoteTally.of(yes(5)));
    expect(site.verification).toBe("unverified");
    site.recordVotes(VoteTally.of([...yes(5), ...yes(1)]));
    expect(site.toFeature().properties).toMatchObject({
      verification: "verified",
      verified_count: 4,
      backers: { count: 10, photo_people: 4, vote_people: 6 },
      insights: { reports: 4 },
    });
    site.merge(report({ id: "jdh_99", device: "device-late", user: "user-late" }));
    expect(site.toFeature().properties).toMatchObject({ verified_count: 5, report_count: 5, insights: { reports: 5 } });
  });

  it("verifies from photos alone when ten people send one", () => {
    const site = Site.found(report());
    photos(site, 9);
    expect(site.toFeature().properties).toMatchObject({ verification: "verified", backers: { count: 10, photo_people: 10 } });
  });

  it("rejects through the no-vote valve, and stays rejected", () => {
    const site = Site.found(report());
    site.recordVotes(VoteTally.of(no(4)));
    expect(site.verification).toBe("rejected");
    site.recordVotes(VoteTally.of([...no(4), ...yes(12)]));
    expect(site.verification).toBe("rejected");
  });

  it("keeps the backers count it had at verification when a yes later turns into a no", () => {
    const site = Site.found(report());
    const ballots = yes(9);
    site.recordVotes(VoteTally.of(ballots));
    expect(site.toFeature().properties.backers).toMatchObject({ count: 10, vote_people: 9 });
    const later = "2026-10-10T07:00:00Z";
    const flipped = ballots.map((ballot, n) => (n === 0 ? { ...ballot, choice: "reject" as const, votedAt: later } : ballot));
    site.recordVotes(VoteTally.of(flipped));
    expect(site.toFeature().properties).toMatchObject({ verification: "verified", backers: { count: 10, vote_people: 8 } });
    expect(site.snapshot().internals.verifiedBackers).toBe(10);
  });

  it("stays verified whatever later votes say", () => {
    const site = Site.found(report());
    photos(site, 9);
    site.recordVotes(VoteTally.of(no(20)));
    expect(site.verification).toBe("verified");
  });

  it("rebuilds an old auto-verified site from its stored photos and votes", () => {
    const fresh = Site.found(report({ id: "jdh_50" })).snapshot();
    const properties = { ...fresh.feature.properties, verification: "verified" as const, verified_count: 1 };
    const small = Site.restore({ ...fresh, feature: { ...fresh.feature, properties } });
    small.rebuild(VoteTally.of([...yes(2), ...no(1)]));
    expect(small.toFeature().properties).toMatchObject({
      verification: "unverified",
      verified_count: 0,
      backers: { count: 3, photo_people: 1, vote_people: 2 },
      votes: { confirm: 2, reject: 1 },
    });
    const big = Site.found(report());
    photos(big, 9);
    big.rebuild(VoteTally.of(no(2)));
    expect(big.toFeature().properties).toMatchObject({ verification: "verified", backers: { count: 10 }, verified_count: 10 });
  });
});
