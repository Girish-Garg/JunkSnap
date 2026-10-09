import { useTranslation } from 'react-i18next';
import { Button } from '../../../ui/Button';
import { useVerifyForm } from '../hooks/useVerifyForm';
import { AUTH_TITLE_ID } from './authIds';
import { AuthHeading } from './AuthHeading';
import { CodeField } from './CodeField';
import { FormFooter } from './FormFooter';

export function VerifyEmailForm() {
  const { t } = useTranslation();
  const form = useVerifyForm();
  const hint = form.sampleCode ? t('auth.sampleCode', { code: form.sampleCode }) : null;
  return (
    <>
      <AuthHeading id={AUTH_TITLE_ID} title={t('auth.verify.title')} text={t('auth.verify.text', { email: form.email })} />
      <form className="form" noValidate onSubmit={form.onSubmit}>
        <CodeField id="verify-code" value={form.code} onChange={form.setCode} errorKey={form.errors.code} hint={hint} />
        <FormFooter error={form.submit.error} busy={form.submit.busy} submitLabel={t('auth.verify.submit')} />
      </form>
      <p className="form__row">
        {form.left > 0 ? (
          <span aria-live="polite">{t('auth.resendIn', { seconds: form.left })}</span>
        ) : (
          <Button variant="text" onClick={form.resend}>
            {t('auth.resend')}
          </Button>
        )}
      </p>
    </>
  );
}
