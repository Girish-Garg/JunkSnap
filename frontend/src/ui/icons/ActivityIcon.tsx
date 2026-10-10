import { CartoonSvg, type CartoonIconProps } from './CartoonSvg';

/** A clipboard with a tick. */
export function ActivityIcon(props: CartoonIconProps) {
  return (
    <CartoonSvg {...props}>
      <rect className="duo" x="4.5" y="4.5" width="15" height="16.5" rx="3" />
      <path className="duo2" d="M9 3h6v3h-6z" />
      <path d="M8.5 13.5l2.5 2.5l4.5-5" />
    </CartoonSvg>
  );
}
