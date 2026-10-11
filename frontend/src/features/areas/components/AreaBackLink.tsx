import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { AREAS_PATH } from '../../../app/paths';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import { Icon } from '../../../ui/Icon';

/**
 * "All areas": back through history when the list is underneath, so back never loops between the two; opened from
 * elsewhere (the map's ranking button, a site's area), the list takes this sheet's place instead.
 */
export function AreaBackLink() {
  const { t } = useTranslation();
  const sheets = useSheetNavigation();
  return (
    <Link
      className="area-back"
      to={AREAS_PATH}
      onClick={(event) => {
        event.preventDefault();
        sheets.up(AREAS_PATH);
      }}
    >
      <Icon name="back" size={20} />
      {t('areas.all')}
    </Link>
  );
}
