import { AreaKey } from '../domain/AreaKey';
import { areaLetterPath, areaPath, feedbackPath, letterPath, sitePath } from './paths';

// Site, area and report ids: letters, digits, '_', '-' and '.' (site_jdh_1, s20-ac-128, rpt_jdh_1).
const ID = /^[A-Za-z0-9][\w.-]{0,119}$/;
// scheme://host/path, without the query and fragment; the https host is not checked (the manifest's filters are).
const LINK = /^(junksnap|https):\/\/([^/?#]*)([^?#]*)/i;

interface LinkRoute {
  // Literal segments, or ':id' and ':kind' for a value.
  readonly pattern: readonly string[];
  build(values: readonly string[]): string;
}

const ROUTES: readonly LinkRoute[] = [
  { pattern: ['sites', ':id'], build: ([id = '']) => sitePath(id) },
  { pattern: ['sites', ':id', 'letter'], build: ([id = '']) => letterPath(id) },
  {
    pattern: ['areas', ':kind', ':id'],
    build: ([kind = '', id = '']) => areaPath(kind, id),
  },
  {
    pattern: ['areas', ':kind', ':id', 'letter'],
    build: ([kind = '', id = '']) => areaLetterPath(kind, id),
  },
  {
    pattern: ['activity', 'reports', ':id'],
    build: ([id = '']) => feedbackPath(id),
  },
];

function valueFits(pattern: string, value: string): boolean {
  if (pattern === ':kind') return AreaKey.isKind(value);
  if (pattern === ':id') return ID.test(value);
  return pattern === value;
}

function decoded(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/**
 * Maps a link that opened the Android app to the app's own route, or null for anything else:
 * junksnap://sites/{id}[/letter], junksnap://areas/{kind}/{id}[/letter], junksnap://activity/reports/{id},
 * and the same paths on an https share link (/share/sites/{id}, /share/areas/{kind}/{id}) or web app link.
 * Values are checked and re-encoded, so a link from another app can only open one of these screens.
 */
export class AppLinkRoutes {
  pathFor(link: string): string | null {
    const parts = AppLinkRoutes.#segments(link);
    if (parts === null) return null;
    for (const route of ROUTES) {
      const path = AppLinkRoutes.#match(route, parts);
      if (path !== null) return path;
    }
    return null;
  }

  // Parsed by hand: older Android WebViews have no URL.canParse and read junksnap://sites/x with an empty host.
  static #segments(link: string): string[] | null {
    const url = LINK.exec(link);
    if (url === null) return null;
    const [, scheme = '', host = '', path = ''] = url;
    const raw = path.split('/').filter((part) => part !== '');
    if (scheme.toLowerCase() === 'junksnap') raw.unshift(host);
    else if (raw[0] === 'share') raw.shift();
    const parts = raw.map(decoded);
    return parts.every((part): part is string => part !== null) ? parts : null;
  }

  static #match(route: LinkRoute, parts: readonly string[]): string | null {
    if (route.pattern.length !== parts.length) return null;
    if (!route.pattern.every((pattern, index) => valueFits(pattern, parts[index] ?? ''))) return null;
    return route.build(parts.filter((_part, index) => route.pattern[index]?.startsWith(':')));
  }
}
