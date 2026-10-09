import { Outlet } from 'react-router';
import { useServices } from '../../../app/useServices';
import { useMapPage } from '../hooks/useMapPage';
import '../map.css';
import type { MapContext } from '../useMapContext';
import { FilterChips } from './FilterChips';
import { MapActions } from './MapActions';
import { MapCredit } from './MapCredit';
import { MapStatus } from './MapStatus';
import { SiteMapView } from './SiteMapView';
import { TopBar } from './TopBar';

export function MapPage() {
  const { config } = useServices();
  const page = useMapPage();
  const context: MapContext = { userLocation: page.location.position };
  return (
    <main className={page.sheetOpen ? 'map-page map-page--sheet' : 'map-page'}>
      <SiteMapView
        sites={page.sites}
        selectedId={page.selectedId}
        userLocation={page.location.position}
        onSelect={page.select}
        onViewChange={page.setView}
      />
      <TopBar sites={page.sites} sampleData={config.apiMode === 'mock'} />
      <FilterChips filter={page.filter} onChange={page.setFilter} />
      <MapStatus notice={page.notice} />
      <MapActions onLocate={page.location.locate} onSnap={page.openSnap} />
      <MapCredit />
      <Outlet context={context} />
    </main>
  );
}
