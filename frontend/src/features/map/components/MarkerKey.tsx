import { useTranslation } from 'react-i18next';

// The same glyphs BadgeIcons draws into the map badges, on a 24 unit grid.
const ROWS = [
  { key: 'boundaries.keyScore', path: 'M2 14h6v8H2zM9 8h6v14H9zM16 2h6v20h-6z' },
  { key: 'boundaries.keyCount', path: 'M1 7h7V3h8v4h7v14H1zM12 10a4 4 0 1 0 0 8a4 4 0 1 0 0-8z' },
] as const;

/** Explains the marker glyphs in words, since the map badges carry only a glyph and a number. */
export function MarkerKey() {
  const { t } = useTranslation();
  return (
    <>
      {ROWS.map((row) => (
        <div key={row.key} className="boundary-legend__ramp">
          <svg className="marker-key__glyph" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <path d={row.path} fillRule="evenodd" fill="currentColor" />
          </svg>
          <span>{t(row.key)}</span>
        </div>
      ))}
    </>
  );
}
