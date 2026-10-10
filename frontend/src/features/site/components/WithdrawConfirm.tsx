import { useTranslation } from 'react-i18next';
import { Button } from '../../../ui/Button';

interface WithdrawConfirmProps {
  readonly busy: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/** The second step: says what withdrawing does before it happens. */
export function WithdrawConfirm({ busy, onConfirm, onCancel }: WithdrawConfirmProps) {
  const { t } = useTranslation();
  return (
    <div className="withdraw-box__confirm">
      <p className="withdraw-box__text">{t('withdraw.confirmText')}</p>
      <div className="withdraw-box__buttons">
        <Button variant="secondary" onClick={onConfirm} disabled={busy}>
          {t(busy ? 'withdraw.busy' : 'withdraw.confirm')}
        </Button>
        <Button variant="text" onClick={onCancel} disabled={busy}>
          {t('withdraw.keep')}
        </Button>
      </div>
    </div>
  );
}
