import { useTranslation } from 'react-i18next';
import { areaLetterPath } from '../../../app/paths';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import { lookOf } from '../../../domain/ActionAvailability';
import { AREA_LETTER_GATE } from '../../../domain/SiteActionGates';
import { Button } from '../../../ui/Button';
import { useGate } from '../../actions/hooks/useGate';
import { useSessionFacts } from '../../actions/hooks/useSessionFacts';

interface AreaLetterButtonProps {
  readonly kind: string;
  readonly areaId: string;
  /** The area has the 10 verified reports the api needs; otherwise the button looks off and a tap says why. */
  readonly ready: boolean;
  /** The ranking list uses the short label. */
  readonly short?: boolean;
}

/** "Draft a letter about this area": sign in first, then the area letter sheet. Off below 10 verified reports. */
export function AreaLetterButton({ kind, areaId, ready, short = false }: AreaLetterButtonProps) {
  const { t } = useTranslation();
  const sheets = useSheetNavigation();
  const gate = useGate();
  const availability = AREA_LETTER_GATE.decide({ ...useSessionFacts(), ready });
  return (
    <div className={short ? 'area-letter area-letter--short' : 'area-letter'}>
      <Button variant={short ? 'text' : 'primary'} onClick={gate(availability, () => sheets.open(areaLetterPath(kind, areaId)))} {...lookOf(availability)}>
        {t(short ? 'areaLetter.short' : 'areaLetter.button')}
      </Button>
      {!ready && <p className="area-letter__locked">{t(short ? 'areaLetter.lockedShort' : 'areaLetter.locked')}</p>}
    </div>
  );
}
