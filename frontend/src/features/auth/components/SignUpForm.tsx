import { useTranslation } from 'react-i18next';
import { Checkbox } from '../../../ui/Checkbox';
import { PasswordField } from '../../../ui/PasswordField';
import { useSignUpForm } from '../hooks/useSignUpForm';
import { AUTH_TITLE_ID } from './authIds';
import { AuthHeading } from './AuthHeading';
import { AuthSwitch } from './AuthSwitch';
import { EmailField } from './EmailField';
import { FormFooter } from './FormFooter';

export function SignUpForm() {
  const { t } = useTranslation();
  const { flow, ...form } = useSignUpForm();
  const translate = (key?: string) => (key ? t(key) : null);
  const hint = t(form.strength ? `auth.strength.${form.strength}` : 'auth.strength.hint');
  return (
    <>
      <AuthHeading id={AUTH_TITLE_ID} title={t('auth.signUp.title')} text={t('auth.signUp.text')} />
      <form className="form" noValidate onSubmit={form.onSubmit}>
        <EmailField id="signup-email" value={form.email} onChange={form.setEmail} errorKey={form.errors.email} />
        <PasswordField
          id="signup-password"
          label={t('auth.password')}
          autoComplete="new-password"
          value={form.password}
          onChange={form.setPassword}
          error={translate(form.errors.password)}
          hint={hint}
        />
        <Checkbox id="signup-terms" label={t('auth.terms')} checked={form.terms} onChange={form.setTerms} error={translate(form.errors.terms)} />
        <FormFooter error={form.submit.error} busy={form.submit.busy} submitLabel={t('auth.signUp.submit')} />
      </form>
      <AuthSwitch question={t('auth.haveAccount')} action={t('auth.signIn.submit')} onClick={() => flow.go('signIn', form.email)} />
    </>
  );
}
