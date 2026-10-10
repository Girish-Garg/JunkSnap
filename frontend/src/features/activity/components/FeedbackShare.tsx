import { useTranslation } from 'react-i18next';
import type { SiteFeature } from '../../../domain/Site';
import { Button } from '../../../ui/Button';
import { useShareSite } from '../../site/hooks/useShareSite';

/** Shares the site's link, so neighbours can open it and confirm or reject it. */
export function FeedbackShare({ site }: { readonly site: SiteFeature }) {
  const { t } = useTranslation();
  const { share, copied } = useShareSite(site);
  return (
    <div className="feedback-next">
      <Button variant="secondary" onClick={share}>
        {t('feedback.share')}
      </Button>
      {copied && (
        <p className="feedback-next__note" role="status">
          {t('feedback.copied')}
        </p>
      )}
    </div>
  );
}
