import { useTranslation } from 'react-i18next';
import { useShareLinks } from '../../../app/useShareLinks';
import type { AreaScores } from '../../../domain/AreaScores';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { useShareLink } from '../../site/hooks/useShareLink';

/** Shares the area page's link; in live mode its preview shows the area's counts. */
export function AreaShareButton({ area }: { readonly area: AreaScores['area'] }) {
  const { t } = useTranslation();
  const links = useShareLinks();
  const { share, copied } = useShareLink();
  return (
    <Button variant="text" onClick={() => share(area.name, links.area(area.kind, area.id))}>
      <Icon name="share" size={20} />
      {t(copied ? 'actions.copied' : 'actions.share')}
    </Button>
  );
}
