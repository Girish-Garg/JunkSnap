import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReportType } from '../../../domain/ReportType';
import type { SiteFeature } from '../../../domain/Site';
import { SiteSearch } from '../../../domain/SiteSearch';

export function useSiteSearch(sites: readonly SiteFeature[], query: string): readonly SiteFeature[] {
  const { t } = useTranslation();
  const search = useMemo(() => new SiteSearch(sites, (type: ReportType) => t(`reportType.${type}`)), [sites, t]);
  return useMemo(() => search.find(query), [search, query]);
}
