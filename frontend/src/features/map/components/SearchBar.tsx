import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Place } from '../../../domain/PlaceSearch';
import type { SiteFeature } from '../../../domain/Site';
import { Icon } from '../../../ui/Icon';
import { IconButton } from '../../../ui/IconButton';
import { LanguageToggle } from '../../../ui/LanguageToggle';
import { Logo } from '../../../ui/Logo';
import { useSearchWords } from '../hooks/useSearchWords';
import { SearchResults } from './SearchResults';

interface SearchBarProps {
  readonly sites: readonly SiteFeature[];
  readonly onPickPlace: (place: Place) => void;
  /** The map shows the pilot city and is what this screen is about (usePilotSearch): the field then names the city. */
  readonly local: boolean;
}

export function SearchBar({ sites, onPickPlace, local }: SearchBarProps) {
  const { t } = useTranslation();
  const words = useSearchWords(local);
  const [query, setQuery] = useState('');
  const pick = (place: Place) => {
    setQuery('');
    onPickPlace(place);
  };
  return (
    <>
      <h1 className="visually-hidden">{t('app.name')}</h1>
      <form className="searchbar" role="search" onSubmit={(event) => event.preventDefault()}>
        <span className="searchbar__lead">
          <Logo markOnly size={28} />
          <Icon name="search" size={20} />
        </span>
        <input
          className="searchbar__input"
          type="search" enterKeyHint="search"
          aria-label={words.label} placeholder={words.placeholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {query && <IconButton icon="close" label={t('search.clear')} onClick={() => setQuery('')} />}
        <LanguageToggle />
      </form>
      {query.trim() && <SearchResults sites={sites} query={query} onPick={pick} />}
    </>
  );
}
