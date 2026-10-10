import { useTranslation } from 'react-i18next';
import type { ClosedReason } from '../SiteClosure';

/** In place of the votes and actions on a site that is off the map: what happened and what still works. */
export function SiteClosedNote({ reason }: { readonly reason: ClosedReason }) {
  const { t } = useTranslation();
  return (
    <section className="site-closed" aria-labelledby="site-closed-title">
      <h3 id="site-closed-title" className="site-closed__title">
        {t('site.closed.title')}
      </h3>
      <p className="site-closed__text">{t(`site.closed.${reason}`)}</p>
    </section>
  );
}
