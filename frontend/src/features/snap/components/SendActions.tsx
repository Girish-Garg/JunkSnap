import { useTranslation } from 'react-i18next';
import { Button } from '../../../ui/Button';

interface SendActionsProps {
  readonly canSend: boolean;
  readonly saveFailed: boolean;
  readonly onSend: () => void;
  readonly onRetake: () => void;
}

export function SendActions({ canSend, saveFailed, onSend, onRetake }: SendActionsProps) {
  const { t } = useTranslation();
  return (
    <div className="snap-actions">
      {saveFailed && (
        <p className="form__error" role="alert">
          {t('snap.saveFailed')}
        </p>
      )}
      <Button onClick={onSend} disabled={!canSend}>
        {t('snap.send')}
      </Button>
      <Button variant="text" onClick={onRetake}>
        {t('snap.retake')}
      </Button>
    </div>
  );
}
