export const SITE_PATH = '/sites/:siteId';
export const SNAP_PATH = '/snap';
export const AREAS_PATH = '/areas';
export const ACTIVITY_PATH = '/activity';
export const ACCOUNT_PATH = '/account';

export function sitePath(siteId: string): string {
  return `/sites/${encodeURIComponent(siteId)}`;
}
