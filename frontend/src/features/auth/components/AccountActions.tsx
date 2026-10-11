import { useTranslation } from 'react-i18next';
import { WELCOME_PATH } from '../../../app/paths';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import { Button } from '../../../ui/Button';
import { useAuthFlow } from '../hooks/useAuthFlow';

interface AccountActionsProps {
  readonly signedIn: boolean;
}

/** Sign in when signed out, and "How JunkSnap works" to see the welcome cards again. Sign out sits at the foot. */
export function AccountActions({ signedIn }: AccountActionsProps) {
  const { t } = useTranslation();
  const flow = useAuthFlow();
  const sheets = useSheetNavigation();
  return (
    <div className="form">
      {!signedIn && <Button onClick={() => flow.go('signIn')}>{t('auth.signIn.submit')}</Button>}
      <Button variant="text" onClick={() => sheets.open(WELCOME_PATH)}>
        {t('account.howItWorks')}
      </Button>
    </div>
  );
}
