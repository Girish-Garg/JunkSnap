import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import { BottomSheet } from '../../../ui/BottomSheet';
import { Logo } from '../../../ui/Logo';
import { useAuthUser } from '../hooks/useAuthUser';
import { AccountActions } from './AccountActions';
import { AppearanceSetting } from './AppearanceSetting';
import { SignOutButton } from './SignOutButton';

const TITLE_ID = 'account-title';

export function AccountRoute() {
  const { t } = useTranslation();
  const user = useAuthUser();
  const sheets = useSheetNavigation();
  const close = useCallback(() => sheets.close('/'), [sheets]);
  return (
    <BottomSheet labelledBy={TITLE_ID} closeLabel={t('account.close')} resizeLabel={t('sheet.resize')} onClose={close}>
      <h2 id={TITLE_ID} className="sheet-title" tabIndex={-1}>
        {t('account.title')}
      </h2>
      <div className="account-card">
        <Logo markOnly size={48} />
        <p>{user ? t('account.signedInAs', { email: user.email }) : t('auth.signIn.text')}</p>
      </div>
      <AccountActions signedIn={Boolean(user)} />
      <AppearanceSetting />
      {user && <SignOutButton onSignedOut={close} />}
    </BottomSheet>
  );
}
