import type { ReactNode } from 'react';
import './illustration.css';

export type IllustrationName = 'clean' | 'offline' | 'camera';

// Small cartoons in the logo's style: thick rounded outline, two or three palette colours (illustration.css).
const ART: Readonly<Record<IllustrationName, ReactNode>> = {
  // A happy bin: nothing to report here.
  clean: (
    <>
      <ellipse className="ill-shadow" cx="60" cy="88" rx="30" ry="5" />
      <path className="ill-accent ill-line" d="M36 36h48l-5 48H41z" />
      <rect className="ill-sun ill-line" x="30" y="26" width="60" height="12" rx="6" />
      <path className="ill-line" d="M52 26v-5h16v5" />
      <circle className="ill-dot" cx="52" cy="54" r="3.5" />
      <circle className="ill-dot" cx="68" cy="54" r="3.5" />
      <path className="ill-line" d="M52 64q8 7 16 0" />
      <path className="ill-line ill-thin" d="M98 22l5-6M104 32l7-1M18 30l-7-3" />
    </>
  ),
  // A sleepy cloud with its plug out.
  offline: (
    <>
      <path className="ill-paper ill-line" d="M34 70h50a16 16 0 0 0 0-32a22 22 0 0 0-42-6a18 18 0 0 0-8 38z" />
      <path className="ill-line" d="M48 52q4 3 8 0M66 52q4 3 8 0M56 60q5 3 10 0" />
      <path className="ill-line" d="M60 70v8q0 8-10 8h-14" />
      <rect className="ill-coral ill-line" x="74" y="80" width="14" height="10" rx="3" />
      <path className="ill-line ill-thin" d="M88 83h6M88 87h6M95 20h8l-8 8h8" />
    </>
  ),
  // The logo camera with its lens shut: the camera is not allowed yet.
  camera: (
    <>
      <rect className="ill-sun ill-line" x="38" y="22" width="22" height="14" rx="5" />
      <rect className="ill-sun ill-line" x="18" y="30" width="84" height="56" rx="18" />
      <circle className="ill-tile ill-line" cx="60" cy="58" r="20" />
      <path className="ill-line" d="M50 58q10 8 20 0" />
      <path className="ill-line ill-thin" d="M47 46l26 24" />
      <circle className="ill-dot" cx="30" cy="42" r="3" />
    </>
  ),
};

interface IllustrationProps {
  readonly name: IllustrationName;
  readonly size?: number;
}

export function Illustration({ name, size = 120 }: IllustrationProps) {
  return (
    <svg className="illustration" width={size} height={(size * 96) / 120} viewBox="0 0 120 96" aria-hidden="true" focusable="false">
      {ART[name]}
    </svg>
  );
}
