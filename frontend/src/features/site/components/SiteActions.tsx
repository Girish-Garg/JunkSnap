import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cleanupPath, letterPath } from '../../../app/paths';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import type { SiteFeature } from '../../../domain/Site';
import { ActionRow, type RowAction } from '../../../ui/ActionRow';
import { useAuthFlow } from '../../auth/hooks/useAuthFlow';
import { useShareSite } from '../hooks/useShareSite';
import type { PrimaryAction } from '../SitePresenter';

interface SiteActionsProps {
  readonly site: SiteFeature;
  readonly primary: PrimaryAction;
  /** Shows the neighbour check box. */
  readonly onConfirm: () => void;
}

/** Confirm opens the vote; Cleaned and Letter open their sheets after sign-in; Me too is not built yet. */
export function SiteActions({ site, primary, onConfirm }: SiteActionsProps) {
  const { t } = useTranslation();
  const sheets = useSheetNavigation();
  const { requireAuth } = useAuthFlow();
  const { share, copied } = useShareSite(site);
  const [tapped, setTapped] = useState(false);
  const siteId = site.properties.site_id;
  const open = (path: string) => () => requireAuth(() => sheets.open(path));
  const actions: readonly RowAction[] = [
    { id: 'confirm', icon: 'confirm', label: t('actions.confirm'), onClick: onConfirm },
    { id: 'metoo', icon: 'metoo', label: t('actions.metoo'), onClick: () => setTapped(true) },
    { id: 'cleaned', icon: 'cleaned', label: t('actions.cleaned'), onClick: open(cleanupPath(siteId)) },
    { id: 'letter', icon: 'letter', label: t('actions.letter'), onClick: open(letterPath(siteId)) },
    { id: 'share', icon: 'share', label: t(copied ? 'actions.copied' : 'actions.share'), onClick: share },
  ];
  const note = tapped ? t('actions.soonOne', { action: t('actions.metoo') }) : '';
  return <ActionRow label={t('actions.label')} actions={actions} primaryId={primary} note={note} />;
}
