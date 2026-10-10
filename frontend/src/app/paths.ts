export const SITE_PATH = '/sites/:siteId';
export const SITE_CLEANUP_PATH = '/sites/:siteId/cleanup';
export const SITE_LETTER_PATH = '/sites/:siteId/letter';
export const SNAP_PATH = '/snap';
export const AREAS_PATH = '/areas';
export const AREA_PATH = '/areas/:kind/:areaId';
export const AREA_LETTER_PATH = '/areas/:kind/:areaId/letter';
export const ACTIVITY_PATH = '/activity';
export const ACCOUNT_PATH = '/account';
export const RANKING_PATH = '/ranking';
export const WELCOME_PATH = '/welcome';

export function sitePath(siteId: string): string {
  return `/sites/${encodeURIComponent(siteId)}`;
}

export function areaPath(kind: string, areaId: string): string {
  return `/areas/${kind}/${encodeURIComponent(areaId)}`;
}

export function cleanupPath(siteId: string): string {
  return `${sitePath(siteId)}/cleanup`;
}

export function letterPath(siteId: string): string {
  return `${sitePath(siteId)}/letter`;
}

export function areaLetterPath(kind: string, areaId: string): string {
  return `${areaPath(kind, areaId)}/letter`;
}
