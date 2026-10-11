import { useEffect, useEffectEvent, useRef } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useConfig } from '../../../app/useConfig';
import type { LatLon } from '../../../domain/ReportUpload';
import { TargetMap, type TargetMapLabels, type TargetMapOptions } from '../TargetMap';

export interface TargetMapState {
  readonly origin: LatLon;
  readonly spot: LatLon;
  readonly headingEnd: LatLon | null;
  readonly onMove: (point: LatLon) => void;
}

function labelsIn(t: TFunction): TargetMapLabels {
  return {
    attribution: t('map.attribution'),
    you: t('longRange.you'),
    pin: t('longRange.pin'),
    twoFingers: t('longRange.twoFingers'),
    ctrlScroll: t('longRange.ctrlScroll'),
    cmdScroll: t('longRange.cmdScroll'),
  };
}

function tryCreate(options: TargetMapOptions, onFail: () => void): TargetMap | null {
  try {
    return new TargetMap(options);
  } catch {
    onFail();
    return null;
  }
}

/** Creates one TargetMap for the container while enabled, and keeps its pin and lines on the placement. */
export function useTargetMap(enabled: boolean, view: TargetMapState, onFail: () => void) {
  const { t } = useTranslation();
  const { map: settings } = useConfig();
  const container = useRef<HTMLDivElement | null>(null);
  const map = useRef<TargetMap | null>(null);
  const onMove = useEffectEvent(view.onMove);
  const failed = useEffectEvent(onFail);
  const showOn = useEffectEvent((created: TargetMap) => created.show(view.spot, view.headingEnd));
  const { lat, lon } = view.origin;
  useEffect(() => {
    if (!enabled || !container.current) return undefined;
    const labels = labelsIn(t);
    const options = { container: container.current, origin: { lat, lon }, labels, onMove: (point: LatLon) => onMove(point), settings };
    const created = tryCreate(options, () => failed());
    if (created) showOn(created);
    map.current = created;
    return () => {
      created?.destroy();
      map.current = null;
    };
  }, [enabled, lat, lon, t, settings]);
  useEffect(() => {
    map.current?.show(view.spot, view.headingEnd);
  }, [view.spot, view.headingEnd]);
  return container;
}
