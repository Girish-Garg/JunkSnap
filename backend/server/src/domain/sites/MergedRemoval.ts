import { InvalidTransitionError } from "./SiteErrors.js";
import type { SiteState } from "./SiteTypes.js";

// Decision 20261011-1730-hem-merged-sites: a same-spot duplicate whose reports moved to an older site leaves the map
// for good and points at that site. Its counts and internals stay as they were, for the audit trail, as on withdrawal.
export class MergedRemoval {
  readonly #state: SiteState;

  constructor(state: SiteState) {
    this.#state = state;
  }

  // A site already merged into keptId comes back unchanged, so a second run writes nothing.
  into(keptId: string, at: string): SiteState {
    const { feature } = this.#state;
    const properties = feature.properties;
    if (properties.status === "removed" && properties.merged_into === keptId) {
      return this.#state;
    }
    if (properties.status === "removed" || properties.site_id === keptId) {
      throw new InvalidTransitionError(`${properties.site_id} cannot merge into ${keptId}`);
    }
    const removed = { status: "removed", removed_reason: "merged", merged_into: keptId, removed_at: at } as const;
    return { ...this.#state, feature: { ...feature, properties: { ...properties, ...removed } } };
  }
}
