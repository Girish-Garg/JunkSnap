import { useTranslation } from 'react-i18next';
import type { DiagnosisView } from '../AreaPresenter';

interface AreaDiagnosisProps {
  readonly items: readonly DiagnosisView[];
}

/** Empty while scores are withheld, so nothing shows. */
export function AreaDiagnosis({ items }: AreaDiagnosisProps) {
  const { t } = useTranslation();
  if (items.length === 0) return null;
  return (
    <section className="area-diagnosis">
      <h3 className="facts__title">{t('areas.diagnosisTitle')}</h3>
      <ul className="area-diagnosis__list">
        {items.map((item) => (
          <li key={item.code} className="area-diagnosis__item">
            <strong>{item.title}</strong>
            <span>{item.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
