import { useTranslation } from 'react-i18next';
import { useServices } from '../../../app/useServices';
import { Button } from '../../../ui/Button';

/** Sign out: a quiet text button at the foot of Account, after the settings. */
export function SignOutButton({ onSignedOut }: { readonly onSignedOut: () => void }) {
  const { t } = useTranslation();
  const { auth } = useServices();
  return (
    <div className="account-signout">
      <Button variant="text" onClick={() => void auth.signOut().then(onSignedOut)}>
        {t('account.signOut')}
      </Button>
    </div>
  );
}
