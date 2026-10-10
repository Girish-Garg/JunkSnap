import { useTranslation } from 'react-i18next';
import { Illustration } from '../../../ui/Illustration';
import { Notice } from '../../../ui/Notice';
import { Skeleton } from '../../../ui/Skeleton';

/** While the report loads, or when it could not be read. */
export function FeedbackPending({ failed }: { readonly failed: boolean }) {
  const { t } = useTranslation();
  if (failed) {
    return (
      <div className="pending-failed">
        <Illustration name="offline" size={104} />
        <Notice icon="info" text={t('feedback.failed')} tone="alert" />
      </div>
    );
  }
  return (
    <div className="feedback-skeleton" role="status">
      <span className="visually-hidden">{t('feedback.loading')}</span>
      <Skeleton width="70%" height="28px" />
      <Skeleton height="72px" />
      <Skeleton height="160px" />
    </div>
  );
}
