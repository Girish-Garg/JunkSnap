import { CartoonSvg, type CartoonIconProps } from './CartoonSvg';

/** A little neighbourhood: two blocks and a flag. */
export function AreasIcon(props: CartoonIconProps) {
  return (
    <CartoonSvg {...props}>
      <path className="duo2" d="M3.5 20.5v-7.5l4-3l4 3v7.5" />
      <path className="duo" d="M11.5 20.5v-10h8v10" />
      <path d="M2.5 20.5h19M14.5 14h2M14.5 17h2M15.5 10.5v-7l4 1.5l-4 1.5" />
    </CartoonSvg>
  );
}
