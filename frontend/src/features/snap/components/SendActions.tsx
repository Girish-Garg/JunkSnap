import { useTranslation } from 'react-i18next';
import { lookOf, type Availability } from '../../../domain/ActionAvailability';
import { Button } from '../../../ui/Button';
import { useGate } from '../../actions/hooks/useGate';

interface SendActionsProps {
  /** Whether the report can be saved now; when not, a tap on Send says why. */
  readonly send: Availability;
  readonly saveFailed: boolean;
  /** Why Send is off although the form is filled, e.g. a no-bin photo with a vague location. */
  readonly notice?: string | null;
  readonly onSend: () => void;
  readonly onRetake: () => void;
}

export function SendActions({ send, saveFailed, notice = null, onSend, onRetake }: SendActionsProps) {
  const { t } = useTranslation();
  const gate = useGate();
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
      <Button onClick={gate(send, onSend)} {...lookOf(send)}>
        {t('snap.send')}
      </Button>
      <Button variant="text" onClick={onRetake}>
        {t('snap.retake')}
      </Button>
    </div>
  );
}
