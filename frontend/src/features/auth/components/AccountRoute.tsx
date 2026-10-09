import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useServices } from '../../../app/useServices';
import { BottomSheet } from '../../../ui/BottomSheet';
import { Button } from '../../../ui/Button';
import { useAuthFlow } from '../hooks/useAuthFlow';
import { useAuthUser } from '../hooks/useAuthUser';

const TITLE_ID = 'account-title';

export function AccountRoute() {
  const { t } = useTranslation();
  const { auth } = useServices();
  const flow = useAuthFlow();
  const user = useAuthUser();
  const navigate = useNavigate();
  const close = useCallback(() => navigate('/'), [navigate]);
  return (
    <BottomSheet labelledBy={TITLE_ID} closeLabel={t('account.close')} resizeLabel={t('sheet.resize')} onClose={close}>
      <h2 id={TITLE_ID} className="sheet-title" tabIndex={-1}>
        {t('account.title')}
      </h2>
      <p className="sheet-text">{user ? t('account.signedInAs', { email: user.email }) : t('auth.signIn.text')}</p>
      <div className="form">
        {user ? (
          <Button variant="text" onClick={() => void auth.signOut().then(close)}>
            {t('account.signOut')}
          </Button>
        ) : (
          <Button onClick={() => flow.go('signIn')}>{t('auth.signIn.submit')}</Button>
        )}
      </div>
    </BottomSheet>
  );
}
