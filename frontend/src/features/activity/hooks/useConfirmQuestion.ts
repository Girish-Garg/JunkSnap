import { useTranslation } from 'react-i18next';
import type { ConfirmationAskView } from '../../../domain/ReportConfirmation';

/** The question in the app's own words, naming the report type when one is known. */
export function useConfirmQuestion(ask: ConfirmationAskView): string {
  const { t } = useTranslation();
  if (ask.reportType === null) return t('confirm.questionPlain');
  return t('confirm.question', { type: t(`reportType.${ask.reportType}`) });
}
