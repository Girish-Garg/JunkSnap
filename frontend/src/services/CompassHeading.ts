/** The fields of a DeviceOrientationEvent that give a compass heading; iOS Safari adds webkitCompassHeading. */
export interface OrientationReading {
  readonly alpha: number | null;
  readonly absolute?: boolean;
  readonly webkitCompassHeading?: number;
}

export type HeadingListener = (degrees: number) => void;

const EVENTS = ['deviceorientationabsolute', 'deviceorientation'] as const;

/**
 * The phone's compass heading, when the browser gives one: degrees clockwise from north. Only absolute readings
 * count, because a relative alpha is not tied to north. Phones without a compass simply never call back.
 */
export class CompassHeading {
  readonly #target: EventTarget | null;

  constructor(target: EventTarget | null) {
    this.#target = target;
  }

  static headingOf(reading: OrientationReading): number | null {
    if (typeof reading.webkitCompassHeading === 'number') return reading.webkitCompassHeading;
    if (reading.absolute === true && reading.alpha !== null) return (360 - reading.alpha) % 360;
    return null;
  }

  /** Calls back on every usable reading; returns the function that stops listening. */
  watch(onHeading: HeadingListener): () => void {
    const target = this.#target;
    if (!target) return () => undefined;
    const listener = (event: Event) => {
      const heading = CompassHeading.headingOf(event as unknown as OrientationReading);
      if (heading !== null) onHeading(heading);
    };
    for (const name of EVENTS) target.addEventListener(name, listener);
    return () => {
      for (const name of EVENTS) target.removeEventListener(name, listener);
    };
  }
}
