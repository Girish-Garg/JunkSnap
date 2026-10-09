import type { ReportType } from '../domain/ReportType';

interface Glyph {
  readonly colour: string;
  readonly shape: string;
}

// Okabe-Ito fills; the shape alone tells the types apart for colour-blind readers.
const GLYPHS: Readonly<Record<ReportType, Glyph>> = {
  waste_dump: { colour: '#d55e00', shape: '<circle cx="12" cy="12" r="8"/>' },
  no_bin: { colour: '#1f2328', shape: '<rect x="4.5" y="4.5" width="15" height="15" rx="2.5"/>' },
  contaminated_water: {
    colour: '#0072b2',
    shape: '<path d="M12 3.5c3 4 6.5 7.6 6.5 11a6.5 6.5 0 0 1-13 0c0-3.4 3.5-7 6.5-11z"/>',
  },
  open_construction: { colour: '#e69f00', shape: '<path d="M12 3.5l9 16H3z"/>' },
};

export class MarkerArt {
  static colour(type: ReportType): string {
    return GLYPHS[type].colour;
  }

  /** SVG markup: a soft dark edge, a white edge, then the coloured shape. */
  static svg(type: ReportType, sizePx: number): string {
    const { colour, shape } = GLYPHS[type];
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 24 24">` +
      `<g fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="4" stroke-linejoin="round">${shape}</g>` +
      `<g fill="${colour}" stroke="#ffffff" stroke-width="2" stroke-linejoin="round">${shape}</g></svg>`
    );
  }

  static dataUrl(type: ReportType, sizePx: number): string {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(MarkerArt.svg(type, sizePx))}`;
  }
}
