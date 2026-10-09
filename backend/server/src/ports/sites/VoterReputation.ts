import type { Voter } from "../../domain/sites/SiteTypes.js";

export interface VoterReputation {
  // The lower of the user's and the device's reputation, 0 to 1; an unknown one counts 0.5.
  reputationOf(voter: Voter): Promise<number>;
}
