import { useTranslation } from 'react-i18next';
import type { AreaKind } from '../../../domain/AreaScores';
import { useAreaShapes } from '../../map/hooks/useAreaShapes';
import type { AreaEntry } from '../hooks/useAreaDirectory';
import { AreaRow } from './AreaRow';

interface AreaGroupProps {
  readonly kind: AreaKind;
  readonly entries: readonly AreaEntry[];
}

/** One kind of area: each row links to its page and always shows its counts, zeros included, and where it stands. */
export function AreaGroup({ kind, entries }: AreaGroupProps) {
  const { t } = useTranslation();
  // Each seat the map draws carries its map colour, so a row and its area on the map match.
  const { tints } = useAreaShapes(true);
  if (entries.length === 0) return null;
  return (
    <section className="area-group">
      <h3 className="area-group__title">{t(`areas.kinds.${kind}`)}</h3>
      <ul className="area-group__list stagger">
        {entries.map((entry) => (
          <AreaRow key={entry.area.key} entry={entry} tint={tints.get(entry.area.id)} />
        ))}
      </ul>
    </section>
  );
}
