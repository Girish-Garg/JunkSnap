// Decision 20261010-1855: the scores CronJob marks lapsed sites expired; nothing is deleted.
export interface SiteExpirer {
  // False when the site was refreshed or settled meanwhile, so it stays as it is.
  expire(siteId: string, now: Date): Promise<boolean>;
}
