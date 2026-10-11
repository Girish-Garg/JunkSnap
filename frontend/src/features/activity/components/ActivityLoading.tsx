import { useTranslation } from 'react-i18next';
import { Skeleton } from '../../../ui/Skeleton';

/** While the first sync of the list is on its way: card-shaped placeholders instead of "Nothing sent yet". */
export function ActivityLoading() {
  const { t } = useTranslation();
  return (
    <div className="activity-skeleton" role="status">
      <span className="visually-hidden">{t('activity.loading')}</span>
      <Skeleton height="112px" />
      <Skeleton height="112px" />
    </div>
  );
}
