import { useTranslation } from 'react-i18next';
import { CrawlProgress, type AreaCrawl } from '../../../domain/AreaCrawl';
import { useFormatter } from '../../../i18n/useFormatter';
import { Icon } from '../../../ui/Icon';

interface CrawlBannerProps {
  readonly crawl: AreaCrawl | null;
}

/** Says official ward data is still coming; nothing once the crawl is done, while loading or on an error. */
export function CrawlBanner({ crawl }: CrawlBannerProps) {
  const { t } = useTranslation();
  const format = useFormatter();
  if (!crawl || !CrawlProgress.collecting(crawl)) return null;
  return (
    <div className="crawl-banner" role="status">
      <Icon name="info" size={20} />
      <p className="crawl-banner__text">
        <span>{t('areas.crawl.collecting')}</span>
        {crawl.expected_by && (
          <span className="crawl-banner__expected">
            {t('areas.crawl.expected', { date: format.dateTime(crawl.expected_by) })}
          </span>
        )}
      </p>
    </div>
  );
}
