import { useTranslation } from 'react-i18next';
import { Button } from '../../../ui/Button';
import { usePilotName } from '../hooks/usePilotName';
import type { ThinActions } from '../hooks/useThinActions';
import '../thin.css';

interface ThinNoteProps {
  /** Sites here, 0 to map.thinMax: always the real count, never rounded up. */
  readonly count: number;
  readonly actions: ThinActions;
  readonly titleId?: string;
}

/**
 * What a view with few or no sites says, honestly, and what to do next: report one, go to the pilot city's reports
 * (away from the city), see the areas, zoom out.
 */
export function ThinNote({ count, actions, titleId }: ThinNoteProps) {
  const { t } = useTranslation();
  const city = usePilotName();
  return (
    <>
      <p id={titleId} className="thin-note__title">
        {count === 0 ? t('thin.none') : t('thin.few', { count })}
      </p>
      <p className="thin-note__body">{t('thin.text')}</p>
      <div className="thin-note__actions">
        <Button variant="sun" size="small" onClick={actions.report}>
          {t(count === 0 ? 'thin.reportFirst' : 'thin.report')}
        </Button>
        {actions.pilot && <Button variant="secondary" size="small" onClick={actions.pilot}>{t('places.seeCity', { city })}</Button>}
        <Button variant="secondary" size="small" onClick={actions.areas}>{t('thin.areas')}</Button>
        {actions.zoomOut && <Button variant="secondary" size="small" onClick={actions.zoomOut}>{t('thin.zoomOut')}</Button>}
      </div>
    </>
  );
}
