import { useTranslation } from 'react-i18next';
import { GpsView } from '../GpsView';
import type { GpsState } from '../hooks/useGpsFix';

export function GpsChip({ gps }: { readonly gps: GpsState }) {
  const { t } = useTranslation();
  const view = GpsView.of(gps);
  return (
    <p className={`gps-chip gps-chip--${view.tone}`} role="status">
      <span className="gps-chip__dot" aria-hidden="true" />
      {t(view.key, { metres: view.metres })}
    </p>
  );
}
