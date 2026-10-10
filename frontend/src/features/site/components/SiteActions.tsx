import { useTranslation } from 'react-i18next';
import { cleanupPath, letterPath } from '../../../app/paths';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import type { SiteFeature } from '../../../domain/Site';
import { ActionRow, type RowAction } from '../../../ui/ActionRow';
import { useAuthFlow } from '../../auth/hooks/useAuthFlow';
import { useMeToo } from '../../community/hooks/useMeToo';
import { useShareSite } from '../hooks/useShareSite';
import type { SitePresenter } from '../SitePresenter';

interface SiteActionsProps {
  readonly site: SiteFeature;
  readonly presenter: SitePresenter;
  /** Shows the neighbour check box. */
  readonly onConfirm: () => void;
  /** After a Me too vote, so the sheet reads the site again. */
  readonly onChanged: () => void;
}

/** Confirm opens the vote; Me too sends a yes vote; Cleaned and Letter open their sheets after sign-in. Letter waits for 10 people. */
export function SiteActions({ site, presenter, onConfirm, onChanged }: SiteActionsProps) {
  const { t } = useTranslation();
  const sheets = useSheetNavigation();
  const { requireAuth } = useAuthFlow();
  const { share, copied } = useShareSite(site);
  const siteId = site.properties.site_id;
  const meToo = useMeToo(siteId, onChanged);
  const letterReady = presenter.letterReady();
  const open = (path: string) => () => requireAuth(() => sheets.open(path));
  const actions: readonly RowAction[] = [
    { id: 'confirm', icon: 'confirm', label: t('actions.confirm'), onClick: onConfirm },
    { id: 'metoo', icon: 'metoo', label: t('actions.metoo'), onClick: meToo.send, disabled: meToo.busy },
    { id: 'cleaned', icon: 'cleaned', label: t('actions.cleaned'), onClick: open(cleanupPath(siteId)) },
    { id: 'letter', icon: 'letter', label: t('actions.letter'), onClick: open(letterPath(siteId)), disabled: !letterReady },
    { id: 'share', icon: 'share', label: t(copied ? 'actions.copied' : 'actions.share'), onClick: share },
  ];
  const note = meToo.note ?? (letterReady ? '' : t('actions.letterLocked'));
  return <ActionRow label={t('actions.label')} actions={actions} primaryId={presenter.primaryAction()} note={note} />;
}
