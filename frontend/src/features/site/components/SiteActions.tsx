import { useTranslation } from 'react-i18next';
import type { SiteFeature } from '../../../domain/Site';
import { ActionRow, type RowAction } from '../../../ui/ActionRow';
import { useShareSite } from '../hooks/useShareSite';

interface SiteActionsProps {
  readonly site: SiteFeature;
}

// Confirm, Me too, Cleaned and Letter are wired in F2 and F4; until then they show as disabled.
export function SiteActions({ site }: SiteActionsProps) {
  const { t } = useTranslation();
  const { share, copied } = useShareSite(site);
  const soon = t('actions.comingSoon');
  const actions: readonly RowAction[] = [
    { id: 'confirm', icon: 'confirm', label: t('actions.confirm'), note: soon },
    { id: 'metoo', icon: 'metoo', label: t('actions.metoo'), note: soon },
    { id: 'cleaned', icon: 'cleaned', label: t('actions.cleaned'), note: soon },
    { id: 'letter', icon: 'letter', label: t('actions.letter'), note: soon },
    { id: 'share', icon: 'share', label: t(copied ? 'actions.copied' : 'actions.share'), onClick: share },
  ];
  return <ActionRow label={t('actions.label')} actions={actions} />;
}
