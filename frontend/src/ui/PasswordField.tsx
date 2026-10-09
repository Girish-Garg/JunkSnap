import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton } from './IconButton';
import { TextField, type TextFieldProps } from './TextField';

type PasswordFieldProps = Omit<TextFieldProps, 'type' | 'variant' | 'trailing'>;

export function PasswordField(props: PasswordFieldProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const toggle = (
    <IconButton
      icon={visible ? 'eyeOff' : 'eye'}
      label={t(visible ? 'auth.hidePassword' : 'auth.showPassword')}
      onClick={() => setVisible(!visible)}
    />
  );
  return <TextField {...props} type={visible ? 'text' : 'password'} variant="with-button" trailing={toggle} />;
}
