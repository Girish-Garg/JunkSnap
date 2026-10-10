import { useTranslation } from 'react-i18next';
import type { OverlayView } from '../EdgeOverlayView';
import type { EdgeState } from '../hooks/useEdgeHints';
import '../edge.css';

interface EdgeOverlayProps {
  readonly state: EdgeState;
  readonly view: OverlayView;
}

/** On-phone boxes and a gentle hint over the viewfinder. Only a hint: the shutter never waits for it. */
export function EdgeOverlay({ state, view }: EdgeOverlayProps) {
  const { t } = useTranslation();
  if (state === 'off') return null;
  const hint = state === 'loading' ? 'edge.loading' : view.spotted ? 'edge.spotted' : 'edge.pointAt';
  return (
    <div className="edge-overlay" data-inference-ms={view.inferenceMs ?? undefined}>
      <div className="edge-overlay__boxes" aria-hidden="true">
        {view.boxes.map((box) => (
          <div
            key={box.key}
            className={`edge-box edge-box--${box.label}`}
            style={{ left: `${box.screen.left}%`, top: `${box.screen.top}%`, width: `${box.screen.width}%`, height: `${box.screen.height}%` }}
          >
            <span className="edge-box__label">
              {t(`edge.class.${box.label}`)} {box.percent}%
            </span>
          </div>
        ))}
      </div>
      <p className={`edge-hint${view.spotted ? ' edge-hint--spotted' : ''}`} role="status">
        {t(hint)}
      </p>
    </div>
  );
}
