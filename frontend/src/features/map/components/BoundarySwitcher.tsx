import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../boundaries.css';
import { IconButton } from '../../../ui/IconButton';
import type { BoundaryLayerState } from '../hooks/useBoundaryLayer';
import { BoundaryPanel } from './BoundaryPanel';

interface BoundarySwitcherProps {
  readonly boundary: BoundaryLayerState;
}

/** A map control that opens the area layer choice above it. */
export function BoundarySwitcher({ boundary }: BoundarySwitcherProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <div className="boundary-switcher">
      {open && <BoundaryPanel boundary={boundary} />}
      <IconButton icon="map" label={t('boundaries.button')} onClick={() => setOpen(!open)} variant="float" expanded={open} />
    </div>
  );
}
