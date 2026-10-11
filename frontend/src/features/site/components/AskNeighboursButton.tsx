import { useTranslation } from 'react-i18next';
import type { SiteProperties } from '../../../domain/Site';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { useAskNeighbours } from '../hooks/useAskNeighbours';

interface AskNeighboursButtonProps {
  readonly site: SiteProperties;
}

/** Only while a site waits for its 10 people: shares its link with "Can you confirm this waste spot near …?". */
export function AskNeighboursButton({ site }: AskNeighboursButtonProps) {
  const { t } = useTranslation();
  const { ask, copied } = useAskNeighbours(site);
  return (
    <Button variant="tonal" onClick={ask}>
      <Icon name="share" size={20} />
      {t(copied ? 'actions.copied' : 'ask.action')}
    </Button>
  );
}
