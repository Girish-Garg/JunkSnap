import { areaPath } from '../../../app/paths';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import type { MapPageState } from '../hooks/useMapPage';
import { AreaCard } from './AreaCard';

interface PickedAreaProps {
  readonly card: MapPageState['areaCard'];
  readonly tints: ReadonlyMap<string, number>;
  /** Closes the card through the history level the map's picks share (usePickLayer). */
  readonly dismiss: () => void;
}

/** The card of the tapped area, on the pick's history level: back, Escape and Close let go of the area. */
export function PickedArea({ card, tints, dismiss }: PickedAreaProps) {
  const sheets = useSheetNavigation();
  const { area } = card;
  if (!area) return null;
  const open = () => {
    // The open page keeps the outline (it is in focus while its route is up); the card goes.
    card.clear();
    sheets.open(areaPath(area.kind, area.id));
  };
  return <AreaCard key={area.id} area={area} tint={tints.get(area.id) ?? null} onOpen={open} onClose={() => dismiss()} />;
}
