import { fireEvent, render, screen } from '@testing-library/react';
import { createPortal } from 'react-dom';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ServicesContext } from '../src/app/ServicesContext';
import { TargetMapView } from '../src/features/snap/components/TargetMapView';
import { MapSupport } from '../src/features/map/MapSupport';
import { BottomSheet } from '../src/ui/BottomSheet';
import { testServices } from './helpers';

vi.mock('maplibre-gl', () => import('./fakeMapLibre'));

beforeAll(() => {
  // jsdom has no pointer capture; the drag only needs the call to succeed.
  Element.prototype.setPointerCapture ??= () => undefined;
});

const ORIGIN = { lat: 26.26183, lon: 73.00352 };

function sheet(children: React.ReactNode) {
  const onClose = vi.fn();
  render(
    <BottomSheet labelledBy="t" closeLabel="Close" resizeLabel="Resize" onClose={onClose}>
      <h2 id="t" tabIndex={-1}>
        Title
      </h2>
      {children}
    </BottomSheet>,
  );
  return { onClose, aside: document.querySelector<HTMLElement>('.sheet') };
}

// A finger going down 400 px from `target`: pointer events, as a phone sends them.
function dragDown(target: Element) {
  const finger = { pointerId: 1, isPrimary: true, button: 0, clientX: 100 };
  fireEvent.pointerDown(target, { ...finger, clientY: 100 });
  fireEvent.pointerMove(target, { ...finger, clientY: 200 });
  const moving = document.querySelector('.sheet')?.classList.contains('sheet--dragging') ?? false;
  fireEvent.pointerMove(target, { ...finger, clientY: 500 });
  fireEvent.pointerUp(target, { ...finger, clientY: 500 });
  return moving;
}

describe('dragging a sheet with pointer events', () => {
  it('a drag down on the handle follows the finger and closes the sheet', () => {
    const { onClose } = sheet(<p>Body</p>);
    expect(dragDown(screen.getByRole('button', { name: 'Resize' }))).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a drag down from the body at the top closes the sheet too', () => {
    const { onClose } = sheet(<p>Body text</p>);
    expect(dragDown(screen.getByText('Body text'))).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

});

describe('touches a sheet must not take', () => {
  // The photo viewer is portaled to <body>, but React still bubbles its events through the sheet.
  it('ignores pointer events from a child portaled out of the sheet', () => {
    const { onClose } = sheet(createPortal(<div>Portaled photo</div>, document.body));
    expect(dragDown(screen.getByText('Portaled photo'))).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('leaves a control with its own drag alone', () => {
    const { onClose } = sheet(<div data-own-drag="">Slider</div>);
    expect(dragDown(screen.getByText('Slider'))).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('dragging the long-range pin map does not drag the Snap sheet', () => {
    vi.spyOn(MapSupport, 'hasWebGl2').mockReturnValue(true);
    // The map reads its style and zooms from the app's configuration.
    const { onClose } = sheet(
      <ServicesContext.Provider value={testServices()}>
        <TargetMapView origin={ORIGIN} spot={ORIGIN} headingEnd={null} onMove={() => undefined} />
      </ServicesContext.Provider>,
    );
    const map = document.querySelector('.target-map');
    expect(map).toHaveAttribute('data-own-drag');
    expect(dragDown(map as Element)).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });
});
