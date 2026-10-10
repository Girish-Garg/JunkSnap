import { useTranslation } from 'react-i18next';
import type { ConfirmationAskView } from '../../../domain/ReportConfirmation';
import type { ReportStatusView } from '../../../domain/ReportStatus';
import { Button } from '../../../ui/Button';
import { useConfirmAnswer } from '../hooks/useConfirmAnswer';
import { useConfirmQuestion } from '../hooks/useConfirmQuestion';
import { ConfirmReason } from './ConfirmReason';

interface ConfirmQuestionProps {
  readonly ask: ConfirmationAskView;
  readonly onAnswered?: (view: ReportStatusView) => void;
}

/** The check was unsure: the question, the AI check's cleaned reason and the two answers. */
export function ConfirmQuestion({ ask, onAnswered }: ConfirmQuestionProps) {
  const { t } = useTranslation();
  const question = useConfirmQuestion(ask);
  const confirm = useConfirmAnswer(ask.reportId, onAnswered);
  return (
    <section className="confirm-ask" aria-label={t('confirm.title')} aria-busy={confirm.busy}>
      <p className="confirm-ask__question">{question}</p>
      <ConfirmReason text={ask.reasoning} />
      <div className="confirm-ask__buttons">
        <Button onClick={() => confirm.answer(true)} disabled={confirm.busy}>
          {t('confirm.sure')}
        </Button>
        <Button variant="secondary" onClick={() => confirm.answer(false)} disabled={confirm.busy}>
          {t('confirm.withdraw')}
        </Button>
      </div>
      {confirm.busy && <p className="confirm-ask__note" role="status">{t('confirm.sending')}</p>}
      {confirm.problem && <p className="form__error" role="alert">{t(`confirm.errors.${confirm.problem}`)}</p>}
    </section>
  );
}
