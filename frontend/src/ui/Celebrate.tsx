import type { CSSProperties } from 'react';
import './illustration.css';

// Fixed spread so every burst looks the same and nothing random runs during render.
const BITS = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2;
  const reach = 70 + (i % 3) * 22;
  return { x: Math.round(Math.cos(angle) * reach), y: Math.round(Math.sin(angle) * reach - 30), r: (i % 2 ? 1 : -1) * (180 + i * 25) };
});

/** A one-off confetti burst for a sent report or a counted vote; hidden under reduced motion. */
export function Celebrate() {
  return (
    <div className="celebrate" aria-hidden="true">
      {BITS.map((bit, i) => {
        const style = { '--i': i, '--x': `${bit.x}px`, '--y': `${bit.y}px`, '--r': `${bit.r}deg` } as CSSProperties;
        return <span key={i} className="celebrate__bit" style={style} />;
      })}
    </div>
  );
}
