export const SITE_PATH = '/sites/:siteId';
export const SNAP_PATH = '/snap';

export function sitePath(siteId: string): string {
  return `/sites/${encodeURIComponent(siteId)}`;
}
