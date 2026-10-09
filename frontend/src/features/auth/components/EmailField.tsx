import { useTranslation } from 'react-i18next';
import { TextField } from '../../../ui/TextField';

interface EmailFieldProps {
  readonly id: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly errorKey?: string;
}

export function EmailField({ id, value, onChange, errorKey }: EmailFieldProps) {
  const { t } = useTranslation();
  return (
    <TextField
      id={id}
      label={t('auth.email')}
      type="email"
      autoComplete="email"
      inputMode="email"
      value={value}
      onChange={onChange}
      error={errorKey ? t(errorKey) : null}
    />
  );
}
