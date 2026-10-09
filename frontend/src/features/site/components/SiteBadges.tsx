import { useTranslation } from 'react-i18next';
import type { SiteProperties } from '../../../domain/Site';

interface SiteBadgesProps {
  readonly site: SiteProperties;
}

export function SiteBadges({ site }: SiteBadgesProps) {
  const { t } = useTranslation();
  const badges = [
    site.cleanup_status === 'checking' && t('site.cleanupChecking'),
    site.pilot && t('site.pilot'),
  ].filter((badge): badge is string => Boolean(badge));
  if (badges.length === 0 && !site.burning) return null;
  return (
    <ul className="badges">
      {site.burning && <li className="badge badge--alert">{t('site.burning')}</li>}
      {badges.map((badge) => (
        <li key={badge} className="badge">
          {badge}
        </li>
      ))}
    </ul>
  );
}
