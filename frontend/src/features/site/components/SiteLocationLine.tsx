import type { SiteLocation } from '../../../domain/Site';
import { useLocationPresenter } from '../hooks/useLocationPresenter';

interface SiteLocationLineProps {
  readonly location: SiteLocation;
}

export function SiteLocationLine({ location }: SiteLocationLineProps) {
  const presenter = useLocationPresenter(location);
  return <p className="site-location-line">{presenter.line()}</p>;
}
