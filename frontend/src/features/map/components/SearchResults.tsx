import { useTranslation } from 'react-i18next';
import type { SiteFeature } from '../../../domain/Site';
import { MarkerGlyph } from '../../../ui/MarkerGlyph';
import { useSiteSearch } from '../hooks/useSiteSearch';

interface SearchResultsProps {
  readonly sites: readonly SiteFeature[];
  readonly query: string;
  readonly onPick: (siteId: string) => void;
}

export function SearchResults({ sites, query, onPick }: SearchResultsProps) {
  const { t } = useTranslation();
  const results = useSiteSearch(sites, query);
  if (results.length === 0) return <p className="search-results search-results--empty">{t('search.noResults')}</p>;
  return (
    <ul className="search-results" aria-label={t('search.results')}>
      {results.map(({ properties: site }) => (
        <li key={site.site_id}>
          <button type="button" className="search-results__item" onClick={() => onPick(site.site_id)}>
            <MarkerGlyph type={site.report_type} />
            <span className="search-results__text">
              <strong>{t(`reportType.${site.report_type}`)}</strong>
              <span>{[site.location.ward?.name, site.location.town].filter(Boolean).join(', ')}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
