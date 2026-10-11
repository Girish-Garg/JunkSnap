import { describe, expect, it } from "vitest";
import { validateSite } from "../../src/contracts/index.gen.js";
import { MergedRemoval } from "../../src/domain/sites/MergedRemoval.js";
import { Site } from "../../src/domain/sites/Site.js";
import { InvalidTransitionError } from "../../src/domain/sites/SiteErrors.js";
import { report } from "./builders.js";
import { NOW } from "./fakes.js";
import { RULES } from "../defaults.js";

// Decision 20261011-1730-hem-merged-sites.
describe("MergedRemoval", () => {
  const state = Site.found(report({ id: "dup" }), RULES).snapshot();

  it("removes the site as merged, pointing at the kept one, and keeps its counts and internals", () => {
    const removed = new MergedRemoval(state).into("site_kept", NOW);
    expect(validateSite(removed.feature).properties).toMatchObject({
      status: "removed",
      removed_reason: "merged",
      merged_into: "site_kept",
      removed_at: NOW,
      report_count: 1,
    });
    expect(removed.internals).toBe(state.internals);
    expect(Site.restore(removed, RULES).toFeature().properties.photo_urls).toEqual([]);
  });

  it("changes nothing when the site is already merged into the same site", () => {
    const removed = new MergedRemoval(state).into("site_kept", NOW);
    expect(new MergedRemoval(removed).into("site_kept", "2026-10-12T00:00:00Z")).toBe(removed);
  });

  it("refuses a site removed for another reason, merged elsewhere, or merging into itself", () => {
    const withdrawn = { ...state, feature: { ...state.feature, properties: { ...state.feature.properties, status: "removed" as const } } };
    const elsewhere = new MergedRemoval(state).into("site_other", NOW);
    expect(() => new MergedRemoval(withdrawn).into("site_kept", NOW)).toThrow(InvalidTransitionError);
    expect(() => new MergedRemoval(elsewhere).into("site_kept", NOW)).toThrow(InvalidTransitionError);
    expect(() => new MergedRemoval(state).into("site_dup", NOW)).toThrow(InvalidTransitionError);
  });
});
