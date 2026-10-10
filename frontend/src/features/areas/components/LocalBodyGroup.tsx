import { useTranslation } from 'react-i18next';
import { AreaDirectory } from '../../../domain/AreaDirectory';
import { PILOT_LOCAL_BODY } from '../../../domain/PilotAreas';

/**
 * The pilot city's local body. No scores route covers a local body and its ward maps are not reviewed yet,
 * so it has no page or counts: the row only says who area letters go To and how reports are counted meanwhile.
 */
export function LocalBodyGroup({ query }: { readonly query: string }) {
  const { t } = useTranslation();
  if (!AreaDirectory.matches(PILOT_LOCAL_BODY.name, query)) return null;
  return (
    <section className="area-group">
      <h3 className="area-group__title">{t('areas.kinds.local_body')}</h3>
      <div className="area-body">
        <span className="area-body__name">{PILOT_LOCAL_BODY.name}</span>
        <span className="area-body__note">{t('areas.localBodyNote')}</span>
      </div>
    </section>
  );
}
