import { useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { sitePath } from '../../../app/paths';
import { useServices } from '../../../app/useServices';
import { BottomSheet } from '../../../ui/BottomSheet';
import '../../../ui/form.css';
import { useLetter } from '../hooks/useLetter';
import '../letters.css';
import { LetterActions } from './LetterActions';
import { LetterChooser } from './LetterChooser';
import { LetterView } from './LetterView';

const TITLE_ID = 'letter-title';

/** "Draft for you to file": a cited letter the resident prints, saves as PDF or copies. */
export function LetterRoute() {
  const { t } = useTranslation();
  const { config } = useServices();
  const { siteId = '' } = useParams();
  const navigate = useNavigate();
  const close = useCallback(() => navigate(sitePath(siteId)), [navigate, siteId]);
  const flow = useLetter(siteId);
  const { draft } = flow;
  return (
    <BottomSheet labelledBy={TITLE_ID} closeLabel={t('letter.close')} resizeLabel={t('sheet.resize')} onClose={close} initial="full" focusKey={draft?.letter_id}>
      <h2 id={TITLE_ID} className="sheet-title" tabIndex={-1}>
        {t('letter.title')}
      </h2>
      <p className="letter-banner">{t('letter.noAutoSend')}</p>
      {config.isSampleData() && <p className="form__note">{t('letter.sample')}</p>}
      {!draft && <LetterChooser flow={flow} />}
      {draft && <LetterView draft={draft} />}
      {draft && <LetterActions draft={draft} onReset={flow.reset} />}
      {draft && createPortal(<LetterView draft={draft} forPrint />, document.body)}
    </BottomSheet>
  );
}
