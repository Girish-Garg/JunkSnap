import type { NearbyVerifiedCounter } from "../ports/NearbyVerifiedCounter.js";

// Placeholder until the sites task counts verified reports near a point.
export class StandInNearbyCounter implements NearbyVerifiedCounter {
  async count(): Promise<number> {
    return 0;
  }
}
