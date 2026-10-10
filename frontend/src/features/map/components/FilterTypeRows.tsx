import { useTranslation } from 'react-i18next';
import { REPORT_TYPES } from '../../../domain/ReportType';
import { SITE_STATES, type SiteFilter } from '../../../domain/SiteFilter';
import { TypeIcon } from '../../../ui/TypeIcon';
import { SwitchRow } from '../../../ui/SwitchRow';
import type { FilterCounts } from '../hooks/useSiteData';

interface FilterTypeRowsProps {
  readonly filter: SiteFilter;
  readonly onChange: (filter: SiteFilter) => void;
  readonly counts: FilterCounts | null;
}

/** One switch per report type, then Verified and Unverified, each with how many sites it shows in this view. */
export function FilterTypeRows({ filter, onChange, counts }: FilterTypeRowsProps) {
  const { t } = useTranslation();
  const meta = (count: number | undefined) => {
    if (counts?.status === 'failed') return t('filters.notLoaded');
    return counts?.status === 'ready' && count !== undefined ? t('filters.inView', { count }) : t('filters.counting');
  };
  return (
    <>
      {REPORT_TYPES.map((type) => (
        <SwitchRow
          key={type}
          label={t(`reportType.${type}`)}
          meta={meta(counts?.counts.types[type])}
          checked={filter.shows(type)}
          onToggle={() => onChange(filter.toggleType(type))}
          leading={<TypeIcon type={type} size={24} />}
        />
      ))}
      {SITE_STATES.map((state) => (
        <SwitchRow
          key={state}
          label={t(`filters.${state}`)}
          meta={meta(counts?.counts.states[state])}
          checked={filter.showsState(state)}
          onToggle={() => onChange(filter.toggleState(state))}
        />
      ))}
    </>
  );
}
