import { useTranslation } from 'react-i18next';
import type { BrandSighting } from '../../../domain/Site';

interface SiteBrandsProps {
  readonly brands: readonly BrandSighting[];
}

export function SiteBrands({ brands }: SiteBrandsProps) {
  const { t } = useTranslation();
  if (brands.length === 0) return null;
  return (
    <section className="facts">
      <h3 className="facts__title">{t('site.brands')}</h3>
      <ul className="brand-list">
        {brands.map(({ brand, parent_company, source_url }) => (
          <li key={`${brand}|${parent_company}`}>
            <span className="brand-list__brand">{brand}</span>
            <a className="brand-list__parent" href={source_url} target="_blank" rel="noopener noreferrer">
              {parent_company}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
