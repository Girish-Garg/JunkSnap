import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { LogoArt } from '../../../ui/LogoArt';
import { useSplash } from '../hooks/useSplash';
import '../splash.css';

/**
 * At start: the camera pops in, the paper ball rolls into the lens, the flash pops, then it shrinks into the logo.
 * "Built on AWS" sits under the mark and fades with the screen.
 */
export function SplashScreen({ onDone }: { readonly onDone: () => void }) {
  const screen = useRef<HTMLDivElement>(null);
  const mark = useRef<SVGSVGElement>(null);
  const skip = useSplash(screen, mark, onDone);
  const { t } = useTranslation();
  return (
    <div ref={screen} className="splash" aria-hidden="true" onPointerDown={skip}>
      <LogoArt ref={mark} size={160} />
      <p className="splash__tagline">{t('splash.builtOn')}</p>
    </div>
  );
}
