import { useTranslation } from 'react-i18next';
import type { SiteProperties } from '../../../domain/Site';
import { Button } from '../../../ui/Button';
import { useWithdraw } from '../hooks/useWithdraw';
import { WithdrawConfirm } from './WithdrawConfirm';

interface WithdrawReportProps {
  readonly site: SiteProperties;
  /** Reads the site again when other people still back it. */
  readonly onChanged: () => void;
}

const TITLE_ID = 'withdraw-title';

/** Shown only to this phone's reporter while the site is unverified; asks once more before withdrawing. */
export function WithdrawReport({ site, onChanged }: WithdrawReportProps) {
  const { t } = useTranslation();
  const withdraw = useWithdraw(site, onChanged);
  if (!withdraw.available) return null;
  const busy = withdraw.stage === 'busy';
  return (
    <section className="withdraw-box" aria-labelledby={TITLE_ID}>
      <h3 id={TITLE_ID} className="withdraw-box__title">{t('withdraw.title')}</h3>
      {withdraw.stage === 'idle' ? (
        <Button variant="text" onClick={withdraw.ask}>
          {t('withdraw.action')}
        </Button>
      ) : (
        <WithdrawConfirm busy={busy} onConfirm={withdraw.confirm} onCancel={withdraw.cancel} />
      )}
      {withdraw.problem && (
        <p className="form__error" role="alert">
          {t(`withdraw.errors.${withdraw.problem}`)}
        </p>
      )}
    </section>
  );
}
