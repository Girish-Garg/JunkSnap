import { useTranslation } from 'react-i18next';
import { TextField } from '../../../ui/TextField';

interface CodeFieldProps {
  readonly id: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly errorKey?: string;
  readonly hint: string | null;
}

/** One numeric input for the 6-digit code, so paste and SMS/email autofill work. */
export function CodeField({ id, value, onChange, errorKey, hint }: CodeFieldProps) {
  const { t } = useTranslation();
  return (
    <TextField
      id={id}
      label={t('auth.code')}
      autoComplete="one-time-code"
      inputMode="numeric"
      maxLength={6}
      variant="code"
      value={value}
      onChange={onChange}
      error={errorKey ? t(errorKey) : null}
      hint={hint}
    />
  );
}
