import type { ReportType } from '../domain/ReportType';
import { ACCENT } from './palette';

interface Glyph {
  readonly colour: string;
  /** White glyph on a 24-unit grid. */
  readonly glyph: string;
}

// Same values as the --type-* tokens in theme.css; the glyph tells types apart without colour.
const GLYPHS: Readonly<Record<ReportType, Glyph>> = {
  waste_dump: {
    colour: '#c5221f',
    glyph: '<path d="M5 7h14M10 4h4M7 7l1 13h8l1-13" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  },
  no_bin: {
    colour: '#e37400',
    glyph: '<path d="M7 8l1 12h8l1-12M5 8h14M4 4l16 16" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  },
  contaminated_water: {
    colour: '#1967d2',
    glyph: '<path d="M12 3.5c3 4 6 7.4 6 10.5a6 6 0 0 1-12 0c0-3.1 3-6.5 6-10.5z" fill="#fff"/>',
  },
  open_construction: {
    colour: '#5d4037',
    glyph: '<path d="M10 4h4l4 14H6zM4 18h16v2.5H4z" fill="#fff" stroke="#fff" stroke-linejoin="round"/>',
  },
};

const SHADOW =
  '<defs><filter id="s" x="-30%" y="-30%" width="160%" height="160%">' +
  '<feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#3c4043" flood-opacity="0.35"/></filter></defs>';

export class MarkerArt {
  /** Round pin: type colour, 2 px white ring, soft shadow; selected adds an accent ring; hollow (unverified) is a dashed outline. */
  static svg(type: ReportType, sizePx: number, selected = false, hollow = false): string {
    const { colour, glyph } = GLYPHS[type];
    const ring = selected ? `<circle cx="16" cy="16" r="14" fill="#fff" stroke="${ACCENT}" stroke-width="3"/>` : '';
    const radius = selected ? 10.5 : 12;
    const scale = (radius * 1.1) / 24;
    const offset = 16 - 12 * scale;
    const disc = hollow
      ? `<circle cx="16" cy="16" r="${radius}" fill="#fff" stroke="${colour}" stroke-width="2.5" stroke-dasharray="4 3"/>`
      : `<circle cx="16" cy="16" r="${radius}" fill="${colour}" stroke="#fff" stroke-width="2"/>`;
    const art = hollow ? glyph.replaceAll('#fff', colour) : glyph;
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 32 32">${SHADOW}` +
      `<g filter="url(#s)">${ring}${disc}</g>` +
      `<g transform="translate(${offset} ${offset}) scale(${scale})">${art}</g></svg>`
    );
  }

  static dataUrl(type: ReportType, sizePx: number, selected = false, hollow = false): string {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(MarkerArt.svg(type, sizePx, selected, hollow))}`;
  }
}
