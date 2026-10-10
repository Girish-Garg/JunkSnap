import { useTranslation } from 'react-i18next';
import { feedbackPath } from '../../../app/paths';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import type { ConfirmationAskView } from '../../../domain/ReportConfirmation';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { IconButton } from '../../../ui/IconButton';
import { useConfirmQuestion } from '../../activity/hooks/useConfirmQuestion';
import '../rejection.css';

interface ConfirmToastCardProps {
  readonly ask: ConfirmationAskView;
  readonly onDismiss: () => void;
}

/** The question in short; the answers live in "What we checked", one tap away. */
export function ConfirmToastCard({ ask, onDismiss }: ConfirmToastCardProps) {
  const { t } = useTranslation();
  const sheets = useSheetNavigation();
  const question = useConfirmQuestion(ask);
  const open = () => {
    onDismiss();
    sheets.open(feedbackPath(ask.reportId));
  };
  return (
    <div className="rejection-toast" role="alert">
      <span className="rejection-toast__icon">
        <Icon name="info" size={20} />
      </span>
      <div className="rejection-toast__text">
        <p className="confirm-toast__question">{question}</p>
        <Button variant="text" onClick={open}>
          {t('confirm.answer')}
        </Button>
      </div>
      <IconButton icon="close" label={t('rejection.dismiss')} onClick={onDismiss} />
    </div>
  );
}
