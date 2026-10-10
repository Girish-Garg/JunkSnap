import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router';
import { AREAS_PATH, areaPath } from '../../../app/paths';
import { useServices } from '../../../app/useServices';
import { AreaKey } from '../../../domain/AreaKey';
import type { AreaKind } from '../../../domain/AreaScores';
import { BottomSheet } from '../../../ui/BottomSheet';
import '../../../ui/form.css';
import { useAreaLetter } from '../hooks/useAreaLetter';
import '../letters.css';
import { AreaIssuePicker } from './AreaIssuePicker';
import { AreaLetterDraftView } from './AreaLetterDraftView';
import { LetterChooser } from './LetterChooser';

const TITLE_ID = 'area-letter-title';

/** /areas/:kind/:areaId/letter; an unknown kind goes back to the area list. */
export function AreaLetterRoute() {
  const { kind = '', areaId = '' } = useParams();
  if (!AreaKey.isKind(kind)) return <Navigate to={AREAS_PATH} replace />;
  return <AreaLetterSheet kind={kind} areaId={areaId} />;
}

/** "Draft for you to file", about a whole area: the same letter as for a site, with the area's evidence. */
function AreaLetterSheet({ kind, areaId }: { readonly kind: AreaKind; readonly areaId: string }) {
  const { t } = useTranslation();
  const { config } = useServices();
  const navigate = useNavigate();
  const close = useCallback(() => navigate(areaPath(kind, areaId)), [navigate, kind, areaId]);
  const flow = useAreaLetter(kind, areaId);
  const { draft } = flow;
  const title = draft ? t('areaLetter.titleFor', { name: draft.area.name }) : t('areaLetter.title');
  return (
    <BottomSheet labelledBy={TITLE_ID} closeLabel={t('letter.close')} resizeLabel={t('sheet.resize')} onClose={close} initial="full" focusKey={draft?.letter_id}>
      <h2 id={TITLE_ID} className="sheet-title" tabIndex={-1}>
        {title}
      </h2>
      <p className="letter-banner">{t('letter.noAutoSend')}</p>
      {config.isSampleData() && <p className="form__note">{t('letter.sample')}</p>}
      {draft ? (
        <AreaLetterDraftView draft={draft} onReset={flow.reset} />
      ) : (
        <>
          <AreaIssuePicker value={flow.issue} onChange={flow.setIssue} />
          <LetterChooser flow={flow} />
        </>
      )}
    </BottomSheet>
  );
}
