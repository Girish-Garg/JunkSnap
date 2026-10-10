import type { ReactNode } from 'react';
import './illustration.css';

export type OnboardingArtName = 'causes' | 'pipeline' | 'scores';

// Same style as Illustration: thick rounded outline, palette fills from illustration.css.
const ART: Readonly<Record<OnboardingArtName, ReactNode>> = {
  // A heap on a plot, a "where does it go?" sign, and a bin that is not there.
  causes: (
    <>
      <path className="ill-line" d="M6 84h108" />
      <path className="ill-tile ill-line" d="M12 84q8-24 22-22q8-12 18 0q10 4 12 22z" />
      <circle className="ill-paper ill-line" cx="34" cy="60" r="7" />
      <path className="ill-line ill-thin" d="M30 57l4 3l5-2M34 60l-1 6" />
      <path className="ill-line" d="M74 84V46" />
      <rect className="ill-sun ill-line" x="60" y="26" width="28" height="20" rx="5" />
      <path className="ill-line ill-thin" d="M70 32q4-4 8 0q0 4-4 5v2M74 42v0.5" />
      <path className="ill-accent ill-line" d="M92 60h20l-2 24h-16z" />
      <rect className="ill-coral ill-line" x="90" y="53" width="24" height="7" rx="3.5" />
      <path className="ill-line ill-thin" d="M97 66l10 12M107 66l-10 12" />
    </>
  ),
  // Phone, blurred face, a tick from the models, then a pin on the map.
  pipeline: (
    <>
      <rect className="ill-paper ill-line" x="8" y="16" width="28" height="52" rx="7" />
      <circle className="ill-sun ill-line" cx="22" cy="38" r="7" />
      <path className="ill-line ill-thin" d="M18 60h8M40 42h6M74 42h6" />
      <rect className="ill-tile ill-line" x="50" y="30" width="22" height="24" rx="5" />
      <path className="ill-line ill-thin" d="M57 30v24M65 30v24M50 38h22M50 46h22" />
      <circle className="ill-accent ill-line" cx="61" cy="74" r="9" />
      <path className="ill-line ill-thin" d="M57 74l3 3l5-6" />
      <path className="ill-sun ill-line" d="M98 18a14 14 0 0 1 14 14c0 12-14 28-14 28s-14-16-14-28a14 14 0 0 1 14-14z" />
      <circle className="ill-paper ill-line" cx="98" cy="32" r="5" />
      <path className="ill-line ill-thin" d="M84 84h28" />
    </>
  ),
  // Three area bars and the "10 verified reports" badge.
  scores: (
    <>
      <path className="ill-line" d="M12 84h96" />
      <rect className="ill-accent ill-line" x="20" y="52" width="18" height="32" rx="5" />
      <rect className="ill-sun ill-line" x="48" y="34" width="18" height="50" rx="5" />
      <rect className="ill-tile ill-line" x="76" y="60" width="18" height="24" rx="5" />
      <circle className="ill-coral ill-line" cx="98" cy="24" r="13" />
      <path className="ill-line ill-thin" d="M92 24l4 4l8-8" />
    </>
  ),
};

export function OnboardingArt({ name }: { readonly name: OnboardingArtName }) {
  return (
    <svg className="illustration" width="168" height="134" viewBox="0 0 120 96" aria-hidden="true" focusable="false">
      {ART[name]}
    </svg>
  );
}
