import { useTranslation } from 'react-i18next';
import { areaLetterPath } from '../../../app/paths';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import { Button } from '../../../ui/Button';
import { useAuthFlow } from '../../auth/hooks/useAuthFlow';

interface AreaLetterButtonProps {
  readonly kind: string;
  readonly areaId: string;
  /** The ranking list uses the short label. */
  readonly short?: boolean;
}

/** "Draft a letter about this area": sign in first, then the area letter sheet. */
export function AreaLetterButton({ kind, areaId, short = false }: AreaLetterButtonProps) {
  const { t } = useTranslation();
  const sheets = useSheetNavigation();
  const { requireAuth } = useAuthFlow();
  return (
    <Button variant={short ? 'text' : 'primary'} onClick={() => requireAuth(() => sheets.open(areaLetterPath(kind, areaId)))}>
      {t(short ? 'areaLetter.short' : 'areaLetter.button')}
    </Button>
  );
}
