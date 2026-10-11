import { useTranslation } from 'react-i18next';
import { WELCOME_PATH } from '../../../app/paths';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import { Button } from '../../../ui/Button';

/** "How JunkSnap works" to see the welcome cards again, signed in or not. Sign in sits in the card above. */
export function AccountActions() {
  const { t } = useTranslation();
  const sheets = useSheetNavigation();
  return (
    <div className="form">
      <Button variant="text" onClick={() => sheets.open(WELCOME_PATH)}>
        {t('account.howItWorks')}
      </Button>
    </div>
  );
}
