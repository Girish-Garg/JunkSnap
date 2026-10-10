import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import type { AreaKind } from '../../../domain/AreaScores';
import { BottomSheet } from '../../../ui/BottomSheet';
import '../areas.css';
import { useAreaScores } from '../hooks/useAreaScores';
import { AREA_TITLE_ID } from './areaIds';
import { AreaPage } from './AreaPage';
import { AreaPending } from './AreaPending';

interface AreaSheetProps {
  readonly kind: AreaKind;
  readonly areaId: string;
}

export function AreaSheet({ kind, areaId }: AreaSheetProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const close = useCallback(() => navigate('/'), [navigate]);
  const state = useAreaScores(kind, areaId);
  return (
    <BottomSheet
      labelledBy={AREA_TITLE_ID}
      closeLabel={t('areas.closeArea')}
      resizeLabel={t('sheet.resize')}
      onClose={close}
      focusKey={state.scores ?? `${state.missing}-${state.failed}`}
    >
      {state.scores ? <AreaPage scores={state.scores} /> : <AreaPending state={state} />}
    </BottomSheet>
  );
}
