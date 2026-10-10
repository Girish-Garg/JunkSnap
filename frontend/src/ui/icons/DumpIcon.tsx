import { CartoonSvg, type CartoonIconProps } from './CartoonSvg';

/** A heap with a paper ball on top. */
export function DumpIcon(props: CartoonIconProps) {
  return (
    <CartoonSvg {...props}>
      <path className="tone" d="M3 19.5q2-7 7-6.5q3-4.5 6.5-.5q4 1 4.5 7z" />
      <circle className="paper" cx="9.5" cy="12" r="2.6" />
      <path d="M15 6.5l1-2M18.5 8l1.5-1M2 19.5h20" />
    </CartoonSvg>
  );
}
