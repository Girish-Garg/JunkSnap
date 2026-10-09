import { useTranslation } from 'react-i18next';
import { REPORT_TYPES } from '../../../domain/ReportType';
import type { SiteFilter } from '../../../domain/SiteFilter';
import { Chip } from '../../../ui/Chip';
import { MarkerGlyph } from '../../../ui/MarkerGlyph';

interface FilterChipsProps {
  readonly filter: SiteFilter;
  readonly onChange: (filter: SiteFilter) => void;
}

/** Type chips carry the marker glyph, so this row is also the legend. */
export function FilterChips({ filter, onChange }: FilterChipsProps) {
  const { t } = useTranslation();
  return (
    <div className="chips" role="group" aria-label={t('filter.label')}>
      {REPORT_TYPES.map((type) => (
        <Chip
          key={type}
          label={t(`filter.${type}`)}
          pressed={filter.hasType(type)}
          onToggle={() => onChange(filter.toggleType(type))}
          leading={<MarkerGlyph type={type} size={18} />}
        />
      ))}
      <Chip
        label={t('filter.verifiedOnly')}
        pressed={filter.verifiedOnly}
        onToggle={() => onChange(filter.toggleVerifiedOnly())}
      />
    </div>
  );
}
