import { useTranslation } from 'react-i18next';
import { Button } from '../../../ui/Button';

interface SendActionsProps {
  readonly canSend: boolean;
  readonly saveFailed: boolean;
  /** Why Send is off although the form is filled, e.g. a no-bin photo with a vague location. */
  readonly notice?: string | null;
  readonly onSend: () => void;
  readonly onRetake: () => void;
}

export function SendActions({ canSend, saveFailed, notice = null, onSend, onRetake }: SendActionsProps) {
  const { t } = useTranslation();
  return (
    <div className="snap-actions">
      {saveFailed && (
        <p className="form__error" role="alert">
          {t('snap.saveFailed')}
        </p>
      )}
      {notice && (
        <p className="form__error" role="alert">
          {notice}
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
