const PATHS = {
  menu: 'M4 7h16M4 12h16M4 17h16',
  search: 'M11 4.5a6.5 6.5 0 1 1 0 13a6.5 6.5 0 0 1 0-13zM16 16l4.5 4.5',
  close: 'M6 6l12 12M18 6L6 18',
  camera: 'M4 8.5h3L8.5 6h7L17 8.5h3V19H4zM12 10.5a3.25 3.25 0 1 1 0 6.5a3.25 3.25 0 0 1 0-6.5z',
  locate: 'M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M12 6.5a5.5 5.5 0 1 1 0 11a5.5 5.5 0 0 1 0-11zM12 11v2',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  confirm: 'M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18zM8 12.5l3 3l5-6',
  metoo: 'M4 8.5h3L8.5 6h7L17 8.5h3V19H4zM12 11v6M9 14h6',
  cleaned: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 15.5l.8 2.2l2.2.8l-2.2.8l-.8 2.2l-.8-2.2l-2.2-.8l2.2-.8z',
  letter: 'M4 6h16v12H4zM4 7l8 6l8-6',
  share: 'M12 4v11M7.5 8.5L12 4l4.5 4.5M5 13v6h14v-6',
  photo: 'M3.5 5.5h17v13h-17zM4.5 17l5-4.5l3.5 3l2.5-2l4 3.5M15.5 8.5h.01',
  offline: 'M7 18h10.5a3.5 3.5 0 0 0 .6-6.95A5.5 5.5 0 0 0 7.5 9.3A4.4 4.4 0 0 0 7 18zM4 4l16 16',
  info: 'M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18zM12 11v5M12 7.5v.01',
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps {
  readonly name: IconName;
  readonly size?: number;
}

export function Icon({ name, size = 24 }: IconProps) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
