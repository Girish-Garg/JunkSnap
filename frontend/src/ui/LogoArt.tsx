import type { Ref } from 'react';

interface LogoArtProps {
  readonly size: number;
  readonly ref?: Ref<SVGSVGElement>;
}

/**
 * The logo mark inline (same drawing as public/brand/junksnap-mark.svg), split into parts the splash animates:
 * body, lens, paper ball and flash.
 */
export function LogoArt({ size, ref }: LogoArtProps) {
  return (
    <svg ref={ref} className="logo-art" width={size} height={size} viewBox="0 0 120 120" fill="none" stroke="#221c15" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g className="logo-art__flash">
        <path d="M101 19l5-8M108 26l9-2M95 15l-1-9" strokeWidth="5" />
      </g>
      <g className="logo-art__body">
        <rect x="24" y="22" width="36" height="22" rx="8" fill="#ffc23d" strokeWidth="6" />
        <rect x="76" y="27" width="20" height="14" rx="5" fill="#ff7a59" strokeWidth="5" />
        <rect x="9" y="36" width="102" height="70" rx="22" fill="#ffc23d" strokeWidth="6" />
        <circle cx="23" cy="52" r="4" fill="#221c15" stroke="none" />
        <circle cx="61" cy="71" r="28" fill="#0b7a73" strokeWidth="6" />
        <path className="logo-art__glint" d="M40 60a24 24 0 0 1 9-10" stroke="#fffdf8" strokeWidth="4" />
      </g>
      <g className="logo-art__paper">
        <path d="M44 66l3-10l7-4l4 2l6-4l8 3l4 7l3 7l-3 7l2 5l-7 7l-8 2l-6-3l-7 1l-5-7l-2-7z" fill="#fffdf8" strokeWidth="4" />
        <path d="M57 62l9 1l4 9l-12 2z" fill="#d9f1ec" stroke="none" />
        <path d="M58 74l12-2l-7 16l-6-3z" fill="#ece1cf" stroke="none" />
        <path d="M54 52l3 10l-10 4M57 62l9 1l6-10M66 63l4 9l9-5M70 72l-7 16M57 62l1 12l-13 5M58 74l12-2M58 74l-1 11" strokeWidth="2.5" />
      </g>
    </svg>
  );
}
