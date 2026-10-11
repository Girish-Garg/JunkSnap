import { useTranslation } from 'react-i18next';
import { ACTIVITY_PATH } from '../../../app/paths';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import { Button } from '../../../ui/Button';
import { Celebration } from '../../../ui/Celebration';

interface NoBinSentStageProps {
  readonly onAgain: () => void;
}

/** After "No bin here" is sent: the tick, what the report does, and the same next steps as a sent photo. */
export function NoBinSentStage({ onAgain }: NoBinSentStageProps) {
  const { t } = useTranslation();
  const sheets = useSheetNavigation();
  return (
    <div className="snap-sent">
      <Celebration />
      <p className="snap-sent__status" role="status">
        {t('nobin.sent')}
      </p>
      <div className="snap-actions">
        <Button onClick={onAgain}>{t('snap.again')}</Button>
        <Button variant="text" onClick={() => sheets.swap(ACTIVITY_PATH)}>
          {t('snap.seeActivity')}
        </Button>
      </div>
    </div>
  );
}
