import { useTranslation } from 'react-i18next';
import type { SiteFeature } from '../../../domain/Site';
import { BottomSheet } from '../../../ui/BottomSheet';
import { useHistoryLayer } from '../../../ui/useHistoryLayer';
import '../stack.css';
import { StackSiteRow } from './StackSiteRow';

const TITLE_ID = 'stack-title';

interface SiteStackSheetProps {
  readonly sites: readonly SiteFeature[];
  readonly onOpen: (site: SiteFeature) => void;
  readonly onClose: () => void;
}

/** Lists every site behind one stack pin; each row opens that site's own sheet. */
export function SiteStackSheet({ sites, onOpen, onClose }: SiteStackSheetProps) {
  const { t } = useTranslation();
  // Its own history entry: back closes the list rather than leaving the map.
  const dismiss = useHistoryLayer('stack', true, onClose);
  // The list's entry goes first, so back from the site sheet returns to the map in one step.
  const open = (site: SiteFeature) => dismiss(() => onOpen(site));
  return (
    <BottomSheet labelledBy={TITLE_ID} closeLabel={t('stack.close')} resizeLabel={t('sheet.resize')} onClose={() => dismiss()}>
      <h2 id={TITLE_ID} className="sheet-title" tabIndex={-1}>
        {t('stack.title', { count: sites.length })}
      </h2>
      <p className="stack-sheet__hint">{t('stack.hint')}</p>
      <ul className="site-rows stack-sheet__rows stagger" aria-label={t('stack.label')}>
        {sites.map((site) => (
          <StackSiteRow key={site.properties.site_id} site={site} onOpen={open} />
        ))}
      </ul>
    </BottomSheet>
  );
}
