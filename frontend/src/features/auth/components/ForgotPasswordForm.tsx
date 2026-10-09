import { useTranslation } from 'react-i18next';
import { PasswordField } from '../../../ui/PasswordField';
import { useForgotForm } from '../hooks/useForgotForm';
import { AUTH_TITLE_ID } from './authIds';
import { AuthHeading } from './AuthHeading';
import { AuthSwitch } from './AuthSwitch';
import { CodeField } from './CodeField';
import { EmailField } from './EmailField';
import { FormFooter } from './FormFooter';

export function ForgotPasswordForm() {
  const { t } = useTranslation();
  const { flow, ...form } = useForgotForm();
  const reset = form.phase === 'reset';
  const hint = form.sampleCode ? t('auth.sampleCode', { code: form.sampleCode }) : null;
  const text = reset ? t('auth.verify.text', { email: form.email }) : t('auth.forgot.text');
  return (
    <>
      <AuthHeading id={AUTH_TITLE_ID} title={t('auth.forgot.title')} text={text} />
      <form className="form" noValidate onSubmit={form.onSubmit}>
        {!reset && <EmailField id="forgot-email" value={form.email} onChange={form.setEmail} errorKey={form.errors.email} />}
        {reset && <CodeField id="forgot-code" value={form.code} onChange={form.setCode} errorKey={form.errors.code} hint={hint} />}
        {reset && (
          <PasswordField
            id="forgot-password"
            label={t('auth.newPassword')}
            autoComplete="new-password"
            value={form.password}
            onChange={form.setPassword}
            error={form.errors.password ? t(form.errors.password) : null}
          />
        )}
        <FormFooter error={form.submit.error} busy={form.submit.busy} submitLabel={t(reset ? 'auth.forgot.save' : 'auth.forgot.send')} />
      </form>
      <AuthSwitch question="" action={t('auth.backToSignIn')} onClick={() => flow.go('signIn', form.email)} />
    </>
  );
}
