import { CartoonSvg, type CartoonIconProps } from './CartoonSvg';

/** A traffic cone on open ground. */
export function ConstructionIcon(props: CartoonIconProps) {
  return (
    <CartoonSvg {...props}>
      <path className="tone" d="M9.5 4h5l4 15.5h-13z" />
      <path className="hi" d="M8.3 10.5h7.4M7.2 14.5h9.6" />
      <path d="M3.5 19.5h17" />
    </CartoonSvg>
  );
}
