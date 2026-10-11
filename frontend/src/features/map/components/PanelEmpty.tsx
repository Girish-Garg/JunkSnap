import { useTranslation } from 'react-i18next';
import { Button } from '../../../ui/Button';
import { EmptyState } from '../../../ui/EmptyState';
import { usePilotName } from '../hooks/usePilotName';
import { useMapContext } from '../useMapContext';

/** The desktop panel with no report in view: says so, and offers the way to the pilot city's reports. */
export function PanelEmpty() {
  const { t } = useTranslation();
  const city = usePilotName();
  const { showPilot } = useMapContext();
  const jump = (
    <Button variant="secondary" onClick={showPilot}>
      {t('places.seeCity', { city })}
    </Button>
  );
  return <EmptyState art="clean" title={t('panel.emptyTitle')} text={t('panel.emptyText')} action={jump} />;
}
