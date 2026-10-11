import { useTranslation } from 'react-i18next';
import { useConfig } from '../../../app/useConfig';
import { AreaProgress } from '../../../domain/AreaProgress';
import { pilotArea } from '../../../domain/PilotAreas';
import { IconButton } from '../../../ui/IconButton';
import { TintSwatch } from '../../../ui/TintSwatch';
import { MAP_CARD_ATTRIBUTE } from '../../../ui/TopLayer';
import { ESCAPE_LAYER } from '../../../ui/useEscapeKey';
import { useMapCard } from '../../../ui/useMapCard';
import { useAreaScores } from '../../areas/hooks/useAreaScores';
import '../../site/site.css';
import type { AreaHit } from '../BoundaryOverlay';
import { AreaCardBody } from './AreaCardBody';

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
  // Escape, a map tap and a swipe down close it, like the pin card; its height lifts the map controls.
  const { card, swipe } = useMapCard(onClose);
  const state = useAreaScores(area.kind, area.id);
  // The row's own flag once it is in, else a pilot-city area's; a scored area is drawn in its score colour, not its tint.
  const pilot = state.scores?.pilot ?? pilotArea(area.kind, area.id) !== null;
  const scored = AreaProgress.of(state.scores, useConfig().site.minVerifiedReports).stage === 'scored';
  return (
    <section
      ref={card}
      className="preview-card area-card"
      aria-label={area.name}
      onPointerDown={swipe.onPointerDown}
      onPointerMove={swipe.onPointerMove}
      onPointerUp={swipe.onPointerUp}
      onPointerCancel={swipe.onPointerCancel}
      {...LAYER}
    >
      <TintSwatch tint={scored ? null : tint} size="large" />
      <AreaCardBody area={area} state={state} pilot={pilot} onOpen={onOpen} />
      <IconButton icon="close" label={t('areas.closeCard')} onClick={onClose} />
    </section>
  );
}
