import { CartoonSvg, type CartoonIconProps } from './CartoonSvg';

/** A magnifying glass finding a small heap by itself, with a sparkle for "automatic". */
export function ScoutIcon(props: CartoonIconProps) {
  return (
    <CartoonSvg {...props}>
      <circle className="paper" cx="10" cy="10" r="6.5" />
      <path className="tone" d="M6 13q1.2-3 3.6-2.6q1.7-2.1 3.5.1q1.5.6 1.3 2.5z" />
      <path d="M14.8 14.8l5.7 5.7M19.5 2.5v3.5M17.75 4.25h3.5" />
    </CartoonSvg>
  );
}
