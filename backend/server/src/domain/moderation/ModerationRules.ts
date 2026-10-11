// The photo checks' limits (contracts/README.md, Limits); ModerationRuleSettings reads each from its variable.
export interface ModerationRules {
  // Room for the phone's offline queue, and for a phone clock running a little fast.
  readonly maxAgeS: number;
  readonly maxAheadS: number;
  readonly duplicateRadiusM: number;
  // pHash Hamming distance at or below which a photo repeats an earlier one.
  readonly duplicateMaxBits: number;
  // How near the site a cleanup after-photo must be taken.
  readonly nearSiteM: number;
}
