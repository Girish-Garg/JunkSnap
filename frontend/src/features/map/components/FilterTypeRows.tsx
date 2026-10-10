import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { REPORT_TYPES } from '../../../domain/ReportType';
import type { SiteFeature } from '../../../domain/Site';
import { SITE_STATES, SiteFilter } from '../../../domain/SiteFilter';
import { TypeIcon } from '../../../ui/TypeIcon';
import { SwitchRow } from '../../../ui/SwitchRow';

interface FilterTypeRowsProps {
  readonly filter: SiteFilter;
  readonly onChange: (filter: SiteFilter) => void;
  readonly sites: readonly SiteFeature[];
}

/** One switch per report type with its count in view, then Verified and Unverified. */
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
      {SITE_STATES.map((state) => (
        <SwitchRow key={state} label={t(`filters.${state}`)} checked={filter.showsState(state)} onToggle={() => onChange(filter.toggleState(state))} />
      ))}
    </>
  );
}
