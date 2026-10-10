import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import type { AreaKind } from '../../../domain/AreaScores';
import { pilotArea } from '../../../domain/PilotAreas';
import { BottomSheet } from '../../../ui/BottomSheet';
import '../areas.css';
import { useAreaName } from '../hooks/useAreaName';
import { useAreaScores } from '../hooks/useAreaScores';
import { AREA_TITLE_ID } from './areaIds';
import { AreaEmpty } from './AreaEmpty';
import { AreaPage } from './AreaPage';
import { AreaPending } from './AreaPending';

interface AreaSheetProps {
  readonly kind: AreaKind;
  readonly areaId: string;
}

export function AreaSheet({ kind, areaId }: AreaSheetProps) {
  const { t } = useTranslation();
  const sheets = useSheetNavigation();
  const close = useCallback(() => sheets.close('/'), [sheets]);
  const state = useAreaScores(kind, areaId);
  // A known area with no reports gets its own page (name, zero counts), not only "no reports".
  const name = useAreaName(kind, areaId);
  const empty = state.missing && name !== null;
  return (
    <BottomSheet
      labelledBy={AREA_TITLE_ID}
      closeLabel={t('areas.closeArea')}
      resizeLabel={t('sheet.resize')}
      onClose={close}
      focusKey={state.scores ?? `${String(state.missing)}-${String(state.failed)}-${String(empty)}`}
    >
      {state.scores && <AreaPage scores={state.scores} />}
      {empty && name !== null && <AreaEmpty kind={kind} name={name} pilot={pilotArea(kind, areaId) !== null} />}
      {!state.scores && !empty && <AreaPending state={state} />}
    </BottomSheet>
  );
}
