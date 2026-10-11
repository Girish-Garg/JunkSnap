import { matchPath } from 'react-router';
import { AREA_LETTER_PATH, SITE_CLEANUP_PATH, SITE_LETTER_PATH, SNAP_PATH } from './paths';

const PATHS: readonly string[] = [SNAP_PATH, SITE_CLEANUP_PATH, SITE_LETTER_PATH, AREA_LETTER_PATH];

/**
 * The sheets that hold work in progress: a capture, a cleanup photo, a letter being drafted (a new draft counts
 * against the hourly limit). Their state lives only in the sheet, so nothing replaces them unasked.
 */
export class WorkSheets {
  static holds(pathname: string): boolean {
    return PATHS.some((path) => matchPath(path, pathname) !== null);
  }
}
