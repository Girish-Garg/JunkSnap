import { CartoonSvg, type CartoonIconProps } from './CartoonSvg';

/** A drop with a ripple. */
export function WaterIcon(props: CartoonIconProps) {
  return (
    <CartoonSvg {...props}>
      <path className="tone" d="M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z" />
      <path className="hi" d="M9 14.5q1.5 1.3 3 0t3 0" />
    </CartoonSvg>
  );
}
