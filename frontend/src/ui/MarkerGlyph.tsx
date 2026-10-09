import type { ReportType } from '../domain/ReportType';
import { MarkerArt } from './MarkerArt';

interface MarkerGlyphProps {
  readonly type: ReportType;
  readonly size?: number;
}

// Decorative: the label next to it carries the meaning.
export function MarkerGlyph({ type, size = 20 }: MarkerGlyphProps) {
  return <img className="marker-glyph" src={MarkerArt.dataUrl(type, size)} width={size} height={size} alt="" />;
}
