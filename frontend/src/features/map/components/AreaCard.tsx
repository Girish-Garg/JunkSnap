import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AreaProgress } from '../../../domain/AreaProgress';
import { pilotArea } from '../../../domain/PilotAreas';
import { Button } from '../../../ui/Button';
import { IconButton } from '../../../ui/IconButton';
import { TintSwatch } from '../../../ui/TintSwatch';
import { MAP_CARD_ATTRIBUTE } from '../../../ui/TopLayer';
import { ESCAPE_LAYER, useEscapeKey } from '../../../ui/useEscapeKey';
import { useAreaScores } from '../../areas/hooks/useAreaScores';
import '../../site/site.css';
import type { AreaHit } from '../BoundaryOverlay';
import { AreaCardLines } from './AreaCardLines';

interface AreaCardProps {
  readonly area: AreaHit;
  /** The area's neighbour tint slot on the map, for the swatch; null before the polygons are read. */
  readonly tint: number | null;
  readonly onOpen: () => void;
  /** Closes the card through its history entry, as back does. */
  readonly onClose: () => void;
}

// Escape reaches the card when it is the top layer; map taps still pass through to the map.
const LAYER = { [ESCAPE_LAYER]: '', [MAP_CARD_ATTRIBUTE]: '' };

/**
 * The card after tapping an area: its name, kind and pilot flag, its counts (zeros included) and where it stands,
 * read from GET /areas/{kind}/{id}/scores (404 means no reports yet), and Open area for the full page.
 */
export function AreaCard({ area, tint, onOpen, onClose }: AreaCardProps) {
  const { t } = useTranslation();
  const card = useRef<HTMLElement>(null);
  useEscapeKey(onClose, card);
  const state = useAreaScores(area.kind, area.id);
  // The row's own flag once it is in; a pilot-city area keeps the flag before it has one.
  const pilot = state.scores?.pilot ?? pilotArea(area.kind, area.id) !== null;
  // The map draws a scored area in its score colour, so its tint swatch would not match.
  const scored = AreaProgress.of(state.scores).stage === 'scored';
  return (
    <section ref={card} className="preview-card area-card" aria-label={area.name} {...LAYER}>
      <TintSwatch tint={scored ? null : tint} size="large" />
      <div className="preview-card__body">
        <p className="preview-card__title">{area.name}</p>
        <p className="preview-card__meta">
          <span>{t(`areas.kind.${area.kind}`)}</span>
          {pilot && <span className="badge">{t('site.pilot')}</span>}
        </p>
        <AreaCardLines state={state} />
        <Button variant="text" onClick={onOpen}>{t('areas.openArea')}</Button>
      </div>
      <IconButton icon="close" label={t('areas.closeCard')} onClick={onClose} />
    </section>
  );
}
