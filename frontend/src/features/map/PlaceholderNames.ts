import type { ExpressionSpecification } from 'maplibre-gl';

// Values that bulk imports wrote into OSM name tags instead of leaving them empty. In Jodhpur a suburb node
// is named "Nan" (its alt_name is the real one), which Positron's suburb labels print upper case as "NAN".
// A real place named exactly Nan (in Thailand) loses its label too, which is fine for a map of India.
const PLACEHOLDERS = ['nan', 'null', 'undefined'];
const NAME_KEYS = ['name', 'name_en', 'name:latin'];

const isPlaceholder = (key: string): ExpressionSpecification => [
  'in',
  ['downcase', ['to-string', ['coalesce', ['get', key], '']]],
  ['literal', PLACEHOLDERS],
];

/** Keeps basemap labels from printing a placeholder name: such a feature gets no label at all. */
export class PlaceholderNames {
  static readonly test: ExpressionSpecification = ['any', ...NAME_KEYS.map(isPlaceholder)];

  /** Wraps a label's text-field expression; a token string or a format expression is left as it is. */
  static guard(textField: unknown): unknown {
    if (!Array.isArray(textField) || textField[0] === 'format') return textField;
    return ['case', PlaceholderNames.test, '', textField];
  }
}
