import { useMemo } from 'react';
import type { SiteProperties } from '../../../domain/Site';
import { SitePresenter } from '../SitePresenter';

export function useSitePresenter(site: SiteProperties): SitePresenter {
  return useMemo(() => new SitePresenter(site), [site]);
}
