import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useServices } from '../../../app/useServices';
import type { BoundaryKind } from '../../../domain/AreaListing';
import { AreaRanking } from '../../../domain/AreaRanking';
import type { AreaScores } from '../../../domain/AreaScores';
import { useFormatter } from '../../../i18n/useFormatter';
import { RankingPresenter, type RankingRowView } from '../RankingPresenter';

const LIMIT = 50;

export interface RankingState {
  readonly rows: readonly RankingRowView[] | null;
  readonly total: number;
  readonly failed: boolean;
}

interface Loaded {
  readonly key: string;
  readonly areas: readonly AreaScores[] | null;
  readonly total: number;
}

/** The city's areas of one kind, worst first as the api orders them, as row texts. */
export function useRanking(kind: BoundaryKind, within: string): RankingState {
  const { areas } = useServices();
  const { t } = useTranslation();
  const format = useFormatter();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const key = `${kind}/${within}`;
  useEffect(() => {
    let current = true;
    areas.list(kind, within, LIMIT).then(
      (listing) => current && setLoaded({ key, areas: listing.areas, total: listing.total }),
      (error: unknown) => {
        console.error(`Could not load the ranking for ${key}`, error);
        if (current) setLoaded({ key, areas: null, total: 0 });
      },
    );
    return () => {
      current = false;
    };
  }, [areas, kind, within, key]);
  const presenter = useMemo(() => new RankingPresenter((k, params) => t(k, params), format), [t, format]);
  const fresh = loaded?.key === key ? loaded : null;
  const rows = useMemo(() => fresh?.areas && AreaRanking.of(fresh.areas).map((area) => presenter.row(area)), [fresh, presenter]);
  return { rows: rows ?? null, total: fresh?.total ?? 0, failed: fresh !== null && fresh.areas === null };
}
