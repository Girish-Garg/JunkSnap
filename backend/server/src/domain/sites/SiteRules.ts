// Photo reports (decision 20261011-0310-hem-photo-flags): distinct people needed to warn or hide a photo, the surplus
// over its backers that hides it early or removes a site, and how near the site a reporter must stand.
export interface PhotoFlagRules {
  readonly warn: number;
  readonly hide: number;
  readonly hideEarly: number;
  readonly surplus: number;
  readonly radiusM: number;
}

// The numbers behind a site's lifecycle; SiteRuleSettings reads each from its variable (contracts/README.md).
export interface SiteRules {
  // No-voters ahead of the backers by this many reject an unverified site.
  readonly rejectMargin: number;
  // People saying cleared, at least, and how many more than those saying still there.
  readonly cleanedQuorum: number;
  readonly clearedMargin: number;
  readonly voteRadiusM: number;
  // Days without a report, vote or accepted after-photo before an open site expires.
  readonly ttlDays: number;
  readonly siteMergeRadiusM: number;
  readonly zoneMergeRadiusM: number;
  readonly flags: PhotoFlagRules;
}

export type MergeRadii = Pick<SiteRules, "siteMergeRadiusM" | "zoneMergeRadiusM">;
export type ClearanceRules = Pick<SiteRules, "cleanedQuorum" | "clearedMargin">;

// Decision 20261011-1610-hem-same-spot-merge: a report always joins a site of its type within siteSameSpotM; farther
// out, up to the merge radius, only when the two photos match at mergeMinCosine or more.
export interface MergeGateRules {
  readonly siteSameSpotM: number;
  readonly mergeMinCosine: number;
}
