import { useTranslation } from 'react-i18next';
import { cleanupPath, letterPath } from '../../../app/paths';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import { lookOf } from '../../../domain/ActionAvailability';
import type { SiteFeature } from '../../../domain/Site';
import type { IconName } from '../../../ui/Icon';
import { ActionRow, type RowAction } from '../../../ui/ActionRow';
import type { GatedAction } from '../../actions/GatedAction';
import type { SiteGates } from '../../actions/hooks/useSiteGates';
import { useMeToo } from '../../community/hooks/useMeToo';
import { useShareSite } from '../hooks/useShareSite';
import type { SitePresenter } from '../SitePresenter';

type RowLabel = Pick<RowAction, 'id' | 'icon' | 'label'>;

// One button of the row: the tap runs it or says why; it looks off unless signing in would fix it.
function gated(label: RowLabel, action: GatedAction, run: () => void): RowAction {
  return { ...label, onClick: action.tap(run), ...lookOf(action.availability) };
}

interface SiteActionsProps {
  readonly site: SiteFeature;
  readonly presenter: SitePresenter;
  readonly gates: SiteGates;
  /** Shows the neighbour check box. */
  readonly onConfirm: () => void;
  /** After a Me too vote, so the sheet reads the site again. */
  readonly onChanged: () => void;
}

/**
 * Confirm opens the vote; Me too sends a yes vote; Cleaned and Letter open their sheets. Each stays in the row when
 * the person cannot use it now (own site, too far, letters waiting for 10 people, offline) and says why when tapped.
 */
export function SiteActions({ site, presenter, gates, onConfirm, onChanged }: SiteActionsProps) {
  const { t } = useTranslation();
  const sheets = useSheetNavigation();
  const { share, copied } = useShareSite(site);
  const siteId = site.properties.site_id;
  const meToo = useMeToo(siteId, onChanged, gates.vote);
  const row = (id: string, icon: IconName, action: GatedAction, run: () => void) => gated({ id, icon, label: t(`actions.${id}`) }, action, run);
  const actions: readonly RowAction[] = [
    row('confirm', 'confirm', gates.vote, onConfirm),
    row('metoo', 'metoo', meToo.action, meToo.send),
    row('cleaned', 'cleaned', gates.cleanup, () => sheets.open(cleanupPath(siteId))),
    row('letter', 'letter', gates.letter, () => sheets.open(letterPath(siteId))),
    { id: 'share', icon: 'share', label: t(copied ? 'actions.copied' : 'actions.share'), onClick: share },
  ];
  const note = meToo.note ?? (presenter.letterReady() ? '' : t('actions.letterLocked'));
  return <ActionRow label={t('actions.label')} actions={actions} primaryId={presenter.primaryAction()} note={note} />;
}
