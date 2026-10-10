import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { REPORT_TYPES } from '../../../domain/ReportType';
import type { SiteFeature } from '../../../domain/Site';
import { SiteFilter } from '../../../domain/SiteFilter';
import { TypeIcon } from '../../../ui/TypeIcon';
import { SwitchRow } from '../../../ui/SwitchRow';

interface FilterTypeRowsProps {
  readonly filter: SiteFilter;
  readonly onChange: (filter: SiteFilter) => void;
  readonly sites: readonly SiteFeature[];
}

/** One switch per report type with its count in view, then "verified only". */
export function FilterTypeRows({ filter, onChange, sites }: FilterTypeRowsProps) {
  const { t } = useTranslation();
  const counts = useMemo(() => SiteFilter.countByType(sites), [sites]);
  return (
    <>
      {REPORT_TYPES.map((type) => (
        <SwitchRow
          key={type}
          label={t(`reportType.${type}`)}
          meta={t('search.siteCount', { count: counts[type] })}
          checked={filter.shows(type)}
          onToggle={() => onChange(filter.toggleType(type))}
          leading={<TypeIcon type={type} size={24} />}
        />
      ))}
      <SwitchRow label={t('filters.verifiedOnly')} checked={filter.verifiedOnly} onToggle={() => onChange(filter.toggleVerifiedOnly())} />
    </>
  );
}
