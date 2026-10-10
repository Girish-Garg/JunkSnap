export const SITE_PATH = '/sites/:siteId';
export const SITE_CLEANUP_PATH = '/sites/:siteId/cleanup';
export const SITE_LETTER_PATH = '/sites/:siteId/letter';
export const SNAP_PATH = '/snap';
export const AREAS_PATH = '/areas';
export const ACTIVITY_PATH = '/activity';
export const ACCOUNT_PATH = '/account';

export function sitePath(siteId: string): string {
  return `/sites/${encodeURIComponent(siteId)}`;
}

export function cleanupPath(siteId: string): string {
  return `${sitePath(siteId)}/cleanup`;
}

export function letterPath(siteId: string): string {
  return `${sitePath(siteId)}/letter`;
}
