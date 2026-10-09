import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { sitePath } from '../../../app/paths';
import type { SiteFeature } from '../../../domain/Site';
import { AppMenu } from './AppMenu';
import { SearchField } from './SearchField';
import { SearchResults } from './SearchResults';

interface TopBarProps {
  readonly sites: readonly SiteFeature[];
  readonly sampleData: boolean;
}

export function TopBar({ sites, sampleData }: TopBarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const pick = useCallback(
    (siteId: string) => {
      setQuery('');
      navigate(sitePath(siteId));
    },
    [navigate],
  );
  return (
    <div className="topbar">
      <div className="searchbar">
        <AppMenu sampleData={sampleData} />
        <SearchField value={query} onChange={setQuery} />
        {sampleData && <span className="pill">{t('app.sampleData')}</span>}
      </div>
      {query.trim() && <SearchResults sites={sites} query={query} onPick={pick} />}
    </div>
  );
}
