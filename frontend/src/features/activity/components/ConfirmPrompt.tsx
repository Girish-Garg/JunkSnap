import { useTranslation } from 'react-i18next';
import { ConfirmationAsk } from '../../../domain/ReportConfirmation';
import type { ReportStatusView } from '../../../domain/ReportStatus';
import { Notice } from '../../../ui/Notice';
import '../feedback.css';
import { ConfirmQuestion } from './ConfirmQuestion';

interface ConfirmPromptProps {
  readonly view: ReportStatusView | null | undefined;
  /** Gets the status the answer returned, so a view that holds its own copy can show it at once. */
  readonly onAnswered?: (view: ReportStatusView) => void;
}

/** Under a report the check was unsure about: the question while it waits, or why it never reached the map (contracts v1.16). */
export function ConfirmPrompt({ view, onAnswered }: ConfirmPromptProps) {
  const { t } = useTranslation();
  const ask = ConfirmationAsk.of(view);
  if (ask) return <ConfirmQuestion key={ask.reportId} ask={ask} onAnswered={onAnswered} />;
  if (view?.status !== 'not_confirmed') return null;
  return (
    <div className="confirm-closed">
      <Notice icon="info" text={t('confirm.notConfirmed')} />
    </div>
  );
}
