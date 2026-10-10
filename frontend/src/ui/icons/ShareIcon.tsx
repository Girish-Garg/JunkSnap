import { CartoonSvg, type CartoonIconProps } from './CartoonSvg';

/** A box with an arrow leaving it. */
export function ShareIcon(props: CartoonIconProps) {
  return (
    <CartoonSvg {...props}>
      <path className="duo2" d="M5 12.5v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
      <path d="M12 3.5v11M8 7.5l4-4l4 4" />
    </CartoonSvg>
  );
}
