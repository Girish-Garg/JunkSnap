// Decision 20261010-1855: a site with no report, vote or cleanup photo for this long leaves the map.
// Soft expiry: the row and its history stay; only the status changes.
export const SITE_TTL_DAYS = 90;

const DAY_MS = 86_400_000;
// Only a site on the active map can expire; cleaned, removed and rejected sites are already off it.
const EXPIRING_STATUSES: ReadonlySet<string> = new Set(["open", "reopened"]);

// The site fields expiry reads; expires_at is absent on rows written before the decision.
export interface ExpiringSite {
  readonly status: string;
  readonly verification: string;
  readonly last_reported_at: string;
  readonly expires_at?: string;
}

// The expiry that activity at this time sets.
export function expiryAfter(activityAt: string): string {
  return new Date(Date.parse(activityAt) + SITE_TTL_DAYS * DAY_MS).toISOString();
}

export function expiryOf(site: ExpiringSite): string {
  return site.expires_at ?? expiryAfter(site.last_reported_at);
}

// Activity only ever pushes the expiry later, so a late-arriving older event changes nothing.
export function refreshedExpiry(site: ExpiringSite, activityAt: string): string {
  const current = expiryOf(site);
  const next = expiryAfter(activityAt);
  return Date.parse(next) > Date.parse(current) ? next : current;
}

export function isLapsedAt(status: string, verification: string, expiresAt: string, now: Date): boolean {
  if (status === "expired") {
    return true;
  }
  const expiring = EXPIRING_STATUSES.has(status) && verification !== "rejected";
  return expiring && now.getTime() > Date.parse(expiresAt);
}

// True once an open or reopened site is past its expiry, whether or not the CronJob has marked it yet.
export function isLapsed(site: ExpiringSite, now: Date): boolean {
  return isLapsedAt(site.status, site.verification, expiryOf(site), now);
}
