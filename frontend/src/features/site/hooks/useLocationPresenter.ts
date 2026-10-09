import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { SiteLocation } from '../../../domain/Site';
import { LocationPresenter } from '../LocationPresenter';

export function useLocationPresenter(location: SiteLocation): LocationPresenter {
  const { t } = useTranslation();
  return useMemo(() => new LocationPresenter(location, (key, params) => t(key, params)), [location, t]);
}
