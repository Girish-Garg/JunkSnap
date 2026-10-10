import { useTranslation } from 'react-i18next';
import { lookOf } from '../../../domain/ActionAvailability';
import type { SiteProperties } from '../../../domain/Site';
import { Button } from '../../../ui/Button';
import type { GatedAction } from '../../actions/GatedAction';
import { useWithdraw } from '../hooks/useWithdraw';
import { WithdrawConfirm } from './WithdrawConfirm';

interface WithdrawReportProps {
  readonly site: SiteProperties;
  /** Whether this person can withdraw here now (useSiteGates). */
  readonly gated: GatedAction;
  /** Reads the site again when other people still back it. */
  readonly onChanged: () => void;
}

const TITLE_ID = 'withdraw-title';

/**
 * Shown only to this phone's reporter; asks once more before withdrawing. On a verified site it stays, looking off,
 * and says that ten people verified it.
 */
export function WithdrawReport({ site, gated, onChanged }: WithdrawReportProps) {
  const { t } = useTranslation();
  const withdraw = useWithdraw(site, gated, onChanged);
  if (!withdraw.shown) return null;
  const { action } = withdraw;
  return (
    <section className="withdraw-box" aria-labelledby={TITLE_ID}>
      <h3 id={TITLE_ID} className="withdraw-box__title">{t('withdraw.title')}</h3>
      {withdraw.stage === 'idle' ? (
        <Button variant="text" onClick={action.tap(withdraw.ask)} blocked={lookOf(action.availability).blocked}>
          {t('withdraw.action')}
        </Button>
      ) : (
        <WithdrawConfirm busy={withdraw.stage === 'busy'} onConfirm={action.tap(withdraw.confirm)} onCancel={withdraw.cancel} />
      )}
      {withdraw.problem && (
        <p className="form__error" role="alert">
          {t(`withdraw.errors.${withdraw.problem}`)}
        </p>
      )}
    </section>
  );
}
