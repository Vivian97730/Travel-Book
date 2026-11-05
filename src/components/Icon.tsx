import type { SVGProps } from "react";

const paths = {
  home: <path d="M3 11.5 12 4l9 7.5v8a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
  bed: <path d="M3 20v-9h18v9M3 16h18M6 11V7h5a3 3 0 0 1 3 3v1" />,
  wallet: <><path d="M4 6h15a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h13" /><path d="M16 12h5v4h-5a2 2 0 0 1 0-4z" /></>,
  list: <path d="m3 6 2 2 4-4M3 13l2 2 4-4M3 20l2 2 4-4M12 6h9M12 13h9M12 20h9" />,
  edit: <><path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10z" /><path d="m14.5 7.5 3 3" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12 4 4L19 6" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6" />,
  plane: <path fill="currentColor" stroke="none" d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />,
  location: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0z" /><circle cx="12" cy="10" r="2" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></>,
  exchange: <path d="M7 7h11l-3-3M17 17H6l3 3" />,
  plug: <path d="M8 3v6M16 3v6M6 9h12v2a6 6 0 0 1-12 0zM12 17v4" />,
  water: <path d="M12 3s6 7 6 12a6 6 0 0 1-12 0c0-5 6-12 6-12z" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>,
  food: <path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M16 3v18M16 3c3 2 4 5 4 8h-4" />,
  train: <><rect x="5" y="3" width="14" height="15" rx="4" /><path d="M8 21l2-3M16 18l2 3M8 8h8M8 13h.01M16 13h.01" /></>,
  sight: <path d="M4 21h16M6 21V10h12v11M8 10V6h8v4M10 6V3h4v3M10 14h4M10 18h4" />,
  shop: <path d="M4 9h16l-1 12H5zM8 9a4 4 0 0 1 8 0" />,
  map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z" /><path d="M9 3v15M15 6v15" /></>,
  chevron: <path d="m9 18 6-6-6-6" />,
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 20, ...props }: SVGProps<SVGSVGElement> & { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {paths[name]}
    </svg>
  );
}
