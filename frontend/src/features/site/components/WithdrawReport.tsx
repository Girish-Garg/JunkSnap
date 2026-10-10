import { useTranslation } from 'react-i18next';
import { lookOf } from '../../../domain/ActionAvailability';
import type { SiteProperties } from '../../../domain/Site';
import type { SiteActionFacts } from '../../../domain/SiteActionGates';
import { Button } from '../../../ui/Button';
import { useGate } from '../../actions/hooks/useGate';
import { useWithdraw } from '../hooks/useWithdraw';
import { WithdrawConfirm } from './WithdrawConfirm';

interface WithdrawReportProps {
  readonly site: SiteProperties;
  readonly facts: SiteActionFacts;
  /** Reads the site again when other people still back it. */
  readonly onChanged: () => void;
}

const TITLE_ID = 'withdraw-title';

/**
 * Shown only to this phone's reporter; asks once more before withdrawing. On a verified site it stays, looking off,
 * and says that ten people verified it.
 */
export function WithdrawReport({ site, facts, onChanged }: WithdrawReportProps) {
  const { t } = useTranslation();
  const gate = useGate();
  const withdraw = useWithdraw(site, facts, onChanged);
  if (!withdraw.shown) return null;
  const { availability } = withdraw;
  return (
    <section className="withdraw-box" aria-labelledby={TITLE_ID}>
      <h3 id={TITLE_ID} className="withdraw-box__title">{t('withdraw.title')}</h3>
      {withdraw.stage === 'idle' ? (
        <Button variant="text" onClick={gate(availability, withdraw.ask)} blocked={lookOf(availability).blocked}>
          {t('withdraw.action')}
        </Button>
      ) : (
        <WithdrawConfirm busy={withdraw.stage === 'busy'} onConfirm={gate(availability, withdraw.confirm)} onCancel={withdraw.cancel} />
      )}
      {withdraw.problem && (
        <p className="form__error" role="alert">
          {t(`withdraw.errors.${withdraw.problem}`)}
        </p>
      )}
    </section>
  );
}
