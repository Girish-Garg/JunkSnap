import { Outlet } from 'react-router';
import { NavBar } from '../../nav/NavBar';
import { useMapFallback } from '../hooks/useMapFallback';
import { useMapPage } from '../hooks/useMapPage';
import { useMapPageContext } from '../hooks/useMapPageContext';
import '../map.css';
import '../overlay.css';
import { FiltersSheet } from './FiltersSheet';
import { MapOverlay } from './MapOverlay';
import { MapSurface } from './MapSurface';

export function MapPage() {
  const page = useMapPage();
  const { listMode, fail } = useMapFallback();
  const { selection, filters } = page;
  const context = useMapPageContext(page);
  const classes = ['map-page', page.sheetOpen && 'map-page--sheet', selection.preview && 'map-page--card'];
  return (
    <main className={classes.filter(Boolean).join(' ')}>
      <div className="map-area">
        <MapSurface
          sites={page.sites}
          selectedId={selection.selectedId}
          {...page.layerBindings}
          userLocation={page.location.position}
          camera={selection.camera}
          onPick={selection.pick}
          onViewChange={page.setView}
          onFail={fail}
          listMode={listMode}
          notice={page.notice}
          onOpen={selection.openDetails}
        />
        <MapOverlay page={page} listMode={listMode} />
        {filters.open && <FiltersSheet filters={filters} onClose={() => filters.setOpen(false)} />}
        <Outlet context={context} />
      </div>
      <NavBar />
    </main>
  );
}
