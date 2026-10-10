import { useRef } from 'react';
import { LogoArt } from '../../../ui/LogoArt';
import { useSplash } from '../hooks/useSplash';
import '../splash.css';

/** At start: the camera pops in, the paper ball rolls into the lens, the flash pops, then it shrinks into the logo. */
export function SplashScreen({ onDone }: { readonly onDone: () => void }) {
  const screen = useRef<HTMLDivElement>(null);
  const mark = useRef<SVGSVGElement>(null);
  const skip = useSplash(screen, mark, onDone);
  return (
    <div ref={screen} className="splash" aria-hidden="true" onPointerDown={skip}>
      <LogoArt ref={mark} size={160} />
    </div>
  );
}
