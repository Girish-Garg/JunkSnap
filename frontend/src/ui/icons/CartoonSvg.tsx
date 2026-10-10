import type { ReactNode } from 'react';
import './icons.css';

export interface CartoonIconProps {
  readonly size?: number;
  /** Give a label only when the icon stands alone; next to text it stays hidden from screen readers. */
  readonly label?: string;
}

interface CartoonSvgProps extends CartoonIconProps {
  readonly children: ReactNode;
}

/**
 * Shared frame for the hand-drawn icons: a 24 grid, the logo's thick rounded outline in currentColor, and two
 * fill tones (.duo, .duo2) that stay empty until the icon is active (icons.css).
 */
export function CartoonSvg({ size = 24, label, children }: CartoonSvgProps) {
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };
  return (
    <svg
      className="icon cicon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      {...a11y}
    >
      {children}
    </svg>
  );
}
