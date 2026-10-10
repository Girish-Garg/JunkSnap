import type { CSSProperties } from 'react';

interface TintSwatchProps {
  /** The area's neighbour tint slot on the map (0-based); nothing is drawn without one. */
  readonly tint: number | undefined | null;
  readonly size?: 'small' | 'large';
}

/** A chip of an area's map colour (--area-tint-n), so a list row or card matches its area on the map. */
export function TintSwatch({ tint, size = 'small' }: TintSwatchProps) {
  if (tint === undefined || tint === null) return null;
  const style = { '--swatch': `var(--area-tint-${String(tint + 1)})` } as CSSProperties;
  return <span className={`tint-swatch tint-swatch--${size}`} style={style} aria-hidden="true" />;
}
