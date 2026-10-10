import { useTranslation } from 'react-i18next';
import { cleanupPath, letterPath } from '../../../app/paths';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import { lookOf, type Availability } from '../../../domain/ActionAvailability';
import type { SiteFeature } from '../../../domain/Site';
import { SITE_GATES, type SiteActionFacts } from '../../../domain/SiteActionGates';
import type { IconName } from '../../../ui/Icon';
import { ActionRow, type RowAction } from '../../../ui/ActionRow';
import { useGate, type Gate } from '../../actions/hooks/useGate';
import { useMeToo } from '../../community/hooks/useMeToo';
import { useShareSite } from '../hooks/useShareSite';
import type { SitePresenter } from '../SitePresenter';

type RowLabel = Pick<RowAction, 'id' | 'icon' | 'label'>;

// One button of the row: the gate runs it, or says why not; it looks off unless signing in would fix it.
function gated(gate: Gate, label: RowLabel, availability: Availability, run: () => void): RowAction {
  return { ...label, onClick: gate(availability, run), ...lookOf(availability) };
}

interface SiteActionsProps {
  readonly site: SiteFeature;
  readonly presenter: SitePresenter;
  readonly facts: SiteActionFacts;
  /** Shows the neighbour check box. */
  readonly onConfirm: () => void;
  /** After a Me too vote, so the sheet reads the site again. */
  readonly onChanged: () => void;
}

/**
 * Confirm opens the vote; Me too sends a yes vote; Cleaned and Letter open their sheets. Each stays in the row when
 * the person cannot use it now (own site, too far, letters waiting for 10 people, offline) and says why when tapped.
 */
export function SiteActions({ site, presenter, facts, onConfirm, onChanged }: SiteActionsProps) {
  const { t } = useTranslation();
  const sheets = useSheetNavigation();
  const gate = useGate();
  const { share, copied } = useShareSite(site);
  const siteId = site.properties.site_id;
  const meToo = useMeToo(siteId, onChanged);
  const vote = SITE_GATES.vote.decide({ ...facts, busy: meToo.busy });
  const letter = SITE_GATES.letter.decide(facts);
  const row = (id: string, icon: IconName, availability: Availability, run: () => void) => gated(gate, { id, icon, label: t(`actions.${id}`) }, availability, run);
  const actions: readonly RowAction[] = [
    row('confirm', 'confirm', SITE_GATES.vote.decide(facts), onConfirm),
    row('metoo', 'metoo', vote, meToo.send),
    row('cleaned', 'cleaned', SITE_GATES.cleanup.decide(facts), () => sheets.open(cleanupPath(siteId))),
    row('letter', 'letter', letter, () => sheets.open(letterPath(siteId))),
    { id: 'share', icon: 'share', label: t(copied ? 'actions.copied' : 'actions.share'), onClick: share },
  ];
  const note = meToo.note ?? (presenter.letterReady() ? '' : t('actions.letterLocked'));
  return <ActionRow label={t('actions.label')} actions={actions} primaryId={presenter.primaryAction()} note={note} />;
}
