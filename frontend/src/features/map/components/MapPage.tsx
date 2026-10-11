import { Outlet } from 'react-router';
import { NavBar } from '../../nav/NavBar';
import { useMapPage } from '../hooks/useMapPage';
import { useMapPageContext } from '../hooks/useMapPageContext';
import { useMapSurface } from '../hooks/useMapSurface';
import { useSheetMapTaps } from '../hooks/useSheetMapTaps';
import '../map.css';
import '../overlay.css';
import { FiltersSheet } from './FiltersSheet';
import { MapOverlay } from './MapOverlay';
import { MapSurface } from './MapSurface';

/** Filters renders after the route sheets: opened over one, it paints on top, as its history entry is on top. */
export function MapPage() {
  const surface = useMapSurface();
  const page = useMapPage(surface.phase);
  const { selection, filters } = page;
  const taps = useSheetMapTaps({ ...selection, ...page.layerBindings, loaded: page.loaded });
  const classes = ['map-page', page.sheetOpen && 'map-page--sheet', (selection.preview ?? page.areaCard.area) && 'map-page--card'];
  return (
    <main className={classes.filter(Boolean).join(' ')}>
      <div className="map-area">
        <MapSurface
          sites={page.sites}
          selectedId={selection.selectedId}
          {...page.layerBindings}
          {...taps}
          userLocation={page.location.position}
          camera={selection.camera}
          onViewChange={page.onViewChange}
          {...surface.bindings}
          listMode={surface.listMode}
          notice={page.notice}
          onOpen={selection.openDetails}
        />
        <MapOverlay page={page} listMode={surface.listMode} onRetryMap={surface.retryMap} />
        <Outlet context={useMapPageContext(page)} />
        {filters.open && <FiltersSheet filters={filters} onClose={() => filters.setOpen(false)} />}
      </div>
      <NavBar />
    </main>
  );
}
