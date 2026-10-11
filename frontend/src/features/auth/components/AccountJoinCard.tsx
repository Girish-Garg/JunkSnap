import { useTranslation } from 'react-i18next';
import { Button } from '../../../ui/Button';
import { Logo } from '../../../ui/Logo';
import { useAuthFlow } from '../hooks/useAuthFlow';

const TITLE_ID = 'account-join-title';

/** Signed out, at the top of Account: what an account unlocks, then Sign in or Create account. */
export function AccountJoinCard() {
  const { t } = useTranslation();
  const flow = useAuthFlow();
  return (
    <section className="account-card account-join" aria-labelledby={TITLE_ID}>
      <Logo markOnly size={48} />
      <h3 id={TITLE_ID} className="account-join__title">
        {t('account.join.title')}
      </h3>
      <p className="account-join__text">{t('account.join.text')}</p>
      <div className="account-join__actions">
        <Button onClick={() => flow.go('signIn')}>{t('auth.signIn.submit')}</Button>
        <Button variant="secondary" onClick={() => flow.go('signUp')}>
          {t('auth.createAccount')}
        </Button>
      </div>
    </section>
  );
}
