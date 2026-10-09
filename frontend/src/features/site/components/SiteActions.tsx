import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SiteFeature } from '../../../domain/Site';
import { ActionRow, type RowAction } from '../../../ui/ActionRow';
import type { IconName } from '../../../ui/Icon';
import { useAuthFlow } from '../../auth/hooks/useAuthFlow';
import { useShareSite } from '../hooks/useShareSite';
import type { PrimaryAction } from '../SitePresenter';

interface SiteActionsProps {
  readonly site: SiteFeature;
  readonly primary: PrimaryAction;
}

// Not built yet (F2 and F4); they still ask for sign-in so the flow is real.
const ACCOUNT_ACTIONS: readonly { readonly id: string; readonly icon: IconName }[] = [
  { id: 'confirm', icon: 'confirm' },
  { id: 'metoo', icon: 'metoo' },
  { id: 'cleaned', icon: 'cleaned' },
  { id: 'letter', icon: 'letter' },
];

export function SiteActions({ site, primary }: SiteActionsProps) {
  const { t } = useTranslation();
  const { requireAuth } = useAuthFlow();
  const { share, copied } = useShareSite(site);
  const [tapped, setTapped] = useState<string | null>(null);
  const actions: readonly RowAction[] = [
    ...ACCOUNT_ACTIONS.map(({ id, icon }) => ({
      id,
      icon,
      label: t(`actions.${id}`),
      onClick: () => requireAuth(() => setTapped(id)),
    })),
    { id: 'share', icon: 'share', label: t(copied ? 'actions.copied' : 'actions.share'), onClick: share },
  ];
  const note = tapped ? t('actions.soonOne', { action: t(`actions.${tapped}`) }) : t('actions.soon');
  return <ActionRow label={t('actions.label')} actions={actions} primaryId={primary} note={note} />;
}
