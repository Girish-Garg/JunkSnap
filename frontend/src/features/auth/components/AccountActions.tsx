import { useTranslation } from 'react-i18next';
import { WELCOME_PATH } from '../../../app/paths';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import { useServices } from '../../../app/useServices';
import { Button } from '../../../ui/Button';
import { useAuthFlow } from '../hooks/useAuthFlow';

interface AccountActionsProps {
  readonly signedIn: boolean;
  readonly onSignedOut: () => void;
}

/** Sign in or out, and "How JunkSnap works" to see the welcome cards again. */
export function AccountActions({ signedIn, onSignedOut }: AccountActionsProps) {
  const { t } = useTranslation();
  const { auth } = useServices();
  const flow = useAuthFlow();
  const sheets = useSheetNavigation();
  return (
    <div className="form">
      {signedIn ? (
        <Button variant="secondary" onClick={() => void auth.signOut().then(onSignedOut)}>
          {t('account.signOut')}
        </Button>
      ) : (
        <Button onClick={() => flow.go('signIn')}>{t('auth.signIn.submit')}</Button>
      )}
      <Button variant="text" onClick={() => sheets.open(WELCOME_PATH)}>
        {t('account.howItWorks')}
      </Button>
    </div>
  );
}
