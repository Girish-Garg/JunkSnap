import type { ReportType } from '../domain/ReportType';
import { ACCENT } from './palette';

interface Glyph {
  readonly colour: string;
  /** White glyph on a 24-unit grid. */
  readonly glyph: string;
}

interface Disc {
  readonly cx: number;
  readonly cy: number;
  readonly radius: number;
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
  overflowing_bin: {
    colour: '#7b3fa6',
    glyph:
      '<path d="M4.5 9.5h11M6 9.5l1 10.5h7l1-10.5M15.8 9.2l3-5.4" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="9" cy="6.8" r="2" fill="#fff"/><circle cx="19" cy="18.4" r="1.8" fill="#fff"/>',
  },
};

const SHADOW =
  '<defs><filter id="s" x="-30%" y="-30%" width="160%" height="160%">' +
  '<feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#3c4043" flood-opacity="0.35"/></filter></defs>';

// Same values as --sun, --ink and --surface in tokens.css: the count sticker and the hollow fill.
const SUN = '#ffc23d';
const INK = '#221c15';
const SURFACE = '#fffdf8';

export class MarkerArt {
  /** Round pin: type colour, 2 px white ring, soft shadow; selected adds an accent ring; hollow (unverified) is a dashed outline. */
  static svg(type: ReportType, sizePx: number, selected = false, hollow = false): string {
    const ring = selected ? `<circle cx="16" cy="16" r="14" fill="#fff" stroke="${ACCENT}" stroke-width="3"/>` : '';
    const radius = selected ? 10.5 : 12;
    const { disc, art } = MarkerArt.#disc(type, { cx: 16, cy: 16, radius }, hollow);
    return MarkerArt.#wrap(sizePx, 32, `<g filter="url(#s)">${ring}${disc}</g>${art}`);
  }

  /**
   * Several sites at one spot on a 40-unit grid: a second disc peeks out at the top left behind the lead type's
   * disc, and a sun sticker at the top right (centre 11 units right of and above the middle) holds the count,
   * which StackPinsLayer draws as text.
   */
  static stackSvg(type: ReportType, sizePx: number, hollow = false): string {
    const { colour } = GLYPHS[type];
    const back = `<circle cx="14" cy="15" r="10.5" fill="${SURFACE}" stroke="${colour}" stroke-width="2.5"/>`;
    const { disc, art } = MarkerArt.#disc(type, { cx: 21, cy: 22, radius: 12 }, hollow);
    const badge = `<circle cx="31" cy="9" r="7.5" fill="${SUN}" stroke="${INK}" stroke-width="1.8"/>`;
    return MarkerArt.#wrap(sizePx, 40, `<g filter="url(#s)">${back}${disc}</g>${art}${badge}`);
  }

  static dataUrl(type: ReportType, sizePx: number, selected = false, hollow = false): string {
    return MarkerArt.#url(MarkerArt.svg(type, sizePx, selected, hollow));
  }

  static stackDataUrl(type: ReportType, sizePx: number, hollow = false): string {
    return MarkerArt.#url(MarkerArt.stackSvg(type, sizePx, hollow));
  }

  static #disc(type: ReportType, { cx, cy, radius }: Disc, hollow: boolean): { disc: string; art: string } {
    const { colour, glyph } = GLYPHS[type];
    const scale = (radius * 1.1) / 24;
    const disc = hollow
      ? `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${SURFACE}" stroke="${colour}" stroke-width="2.5" stroke-dasharray="4 3"/>`
      : `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${colour}" stroke="#fff" stroke-width="2"/>`;
    const paths = hollow ? glyph.replaceAll('#fff', colour) : glyph;
    const art = `<g transform="translate(${cx - 12 * scale} ${cy - 12 * scale}) scale(${scale})">${paths}</g>`;
    return { disc, art };
  }

  static #wrap(sizePx: number, box: number, body: string): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${box} ${box}">${SHADOW}${body}</svg>`;
  }

  static #url(svg: string): string {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }
}
