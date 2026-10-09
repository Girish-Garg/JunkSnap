import type { Vote } from "../../domain/sites/VoteTally.js";

export interface VoteRepository {
  // One vote per site and device; a later vote replaces the earlier one.
  put(vote: Vote): Promise<void>;
  // Strongly consistent, so the vote just put is included.
  forSite(siteId: string): Promise<Vote[]>;
}
