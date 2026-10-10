export const SITE_PATH = '/sites/:siteId';
export const SNAP_PATH = '/snap';
export const AREAS_PATH = '/areas';
export const AREA_PATH = '/areas/:kind/:areaId';
export const ACTIVITY_PATH = '/activity';
export const ACCOUNT_PATH = '/account';

export function sitePath(siteId: string): string {
  return `/sites/${encodeURIComponent(siteId)}`;
}

export function areaPath(kind: string, areaId: string): string {
  return `/areas/${kind}/${encodeURIComponent(areaId)}`;
}
