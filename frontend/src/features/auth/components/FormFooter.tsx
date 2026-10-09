import { useTranslation } from 'react-i18next';
import { Button } from '../../../ui/Button';

interface FormFooterProps {
  readonly error: string | null;
  readonly busy: boolean;
  readonly submitLabel: string;
}

/** The server error, if any, then the submit button. */
export function FormFooter({ error, busy, submitLabel }: FormFooterProps) {
  const { t } = useTranslation();
  return (
    <>
      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? t('auth.working') : submitLabel}
      </Button>
    </>
  );
}
