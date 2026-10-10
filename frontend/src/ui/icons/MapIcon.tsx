import { CartoonSvg, type CartoonIconProps } from './CartoonSvg';

/** A folded map with a pin on it. */
export function MapIcon(props: CartoonIconProps) {
  return (
    <CartoonSvg {...props}>
      <path className="duo2" d="M3.5 7l5-2l7 2l5-2v12.5l-5 2l-7-2l-5 2z" />
      <path d="M8.5 5v12.5M15.5 7v12.5" />
      <path className="duo" d="M15.5 2.5a3 3 0 0 1 3 3c0 2.2-3 5-3 5s-3-2.8-3-5a3 3 0 0 1 3-3z" />
    </CartoonSvg>
  );
}
