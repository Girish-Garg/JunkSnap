import { useTranslation } from 'react-i18next';
import { Button } from '../../../ui/Button';
import { PasswordField } from '../../../ui/PasswordField';
import { useSignInForm } from '../hooks/useSignInForm';
import { AUTH_TITLE_ID } from './authIds';
import { AuthHeading } from './AuthHeading';
import { AuthSwitch } from './AuthSwitch';
import { EmailField } from './EmailField';
import { FormFooter } from './FormFooter';

export function SignInForm() {
  const { t } = useTranslation();
  const { flow, ...form } = useSignInForm();
  const passwordError = form.errors.password ? t(form.errors.password) : null;
  const intro = flow.notice ?? t(form.available ? 'auth.signIn.text' : 'auth.unavailable');
  return (
    <>
      <AuthHeading id={AUTH_TITLE_ID} title={t('auth.signIn.title')} text={intro} />
      <form className="form" noValidate onSubmit={form.onSubmit}>
        <EmailField id="signin-email" value={form.email} onChange={form.setEmail} errorKey={form.errors.email} />
        <PasswordField
          id="signin-password"
          label={t('auth.password')}
          autoComplete="current-password"
          value={form.password}
          onChange={form.setPassword}
          error={passwordError}
        />
        <Button variant="text" onClick={() => flow.go('forgot', form.email)}>
          {t('auth.forgotLink')}
        </Button>
        <FormFooter error={form.submit.error} busy={form.submit.busy} submitLabel={t('auth.signIn.submit')} />
      </form>
      <AuthSwitch question={t('auth.noAccount')} action={t('auth.createAccount')} onClick={() => flow.go('signUp', form.email)} />
    </>
  );
}
