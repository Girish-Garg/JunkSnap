import { useTranslation } from 'react-i18next';
import type { BadgeView } from '../SitePresenter';

interface SiteBadgesProps {
  readonly badges: readonly BadgeView[];
}

export function SiteBadges({ badges }: SiteBadgesProps) {
  const { t } = useTranslation();
  if (badges.length === 0) return null;
  return (
    <ul className="badges">
      {badges.map((badge) => (
        <li key={badge.key} className={badge.tone === 'alert' ? 'badge badge--alert' : 'badge'}>
          {t(badge.key, badge.params)}
        </li>
      ))}
    </ul>
  );
}
