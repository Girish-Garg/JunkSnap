import { useTranslation } from 'react-i18next';
import type { Place } from '../../../domain/PlaceSearch';
import type { SiteFeature } from '../../../domain/Site';
import { usePlaceSearch } from '../hooks/usePlaceSearch';

interface SearchResultsProps {
  readonly sites: readonly SiteFeature[];
  readonly query: string;
  readonly onPick: (place: Place) => void;
}

export function SearchResults({ sites, query, onPick }: SearchResultsProps) {
  const { t } = useTranslation();
  const places = usePlaceSearch(sites, query);
  if (places.length === 0) return <p className="search-results search-results--empty">{t('search.noResults')}</p>;
  return (
    <ul className="search-results" aria-label={t('search.results')}>
      {places.map((place) => (
        <li key={`${place.kind}:${place.name}`}>
          <button type="button" className="search-results__item" onClick={() => onPick(place)}>
            <span>{place.name}</span>
            <span className="search-results__meta">
              {t(`place.${place.kind}`)} · {t('search.siteCount', { count: place.sites.length })}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
