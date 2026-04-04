import type { PropsWithChildren } from 'react';
import type { NavIcon } from '@/types/dashboard';

type IconProps = {
  className?: string;
};

type SidebarIconProps = IconProps & {
  name: NavIcon;
};

function Svg({ className, children }: PropsWithChildren<IconProps>) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export function SidebarIcon({ name, className }: SidebarIconProps) {
  if (name === 'facility') {
    return (
      <Svg className={className}>
        <rect x="4" y="8" width="16" height="12" rx="2" />
        <path d="M8 8V5h8v3" />
        <path d="M8 13h8" />
      </Svg>
    );
  }

  if (name === 'license') {
    return (
      <Svg className={className}>
        <path d="M7 4h10l2 3v13l-7-3-7 3V7l2-3Z" />
        <path d="M9 10h6" />
      </Svg>
    );
  }

  if (name === 'personnel') {
    return (
      <Svg className={className}>
        <circle cx="9" cy="9" r="3" />
        <path d="M4.5 18a4.5 4.5 0 0 1 9 0" />
        <path d="M16 8h4" />
        <path d="M18 6v4" />
      </Svg>
    );
  }

  if (name === 'test') {
    return (
      <Svg className={className}>
        <path d="M7 3h10" />
        <path d="M9 3v5l-4 7a4 4 0 0 0 3.4 6h7.2A4 4 0 0 0 19 15l-4-7V3" />
        <path d="M9 14h6" />
      </Svg>
    );
  }

  if (name === 'document') {
    return (
      <Svg className={className}>
        <path d="M7 3h7l5 5v13H7z" />
        <path d="M14 3v5h5" />
        <path d="M10 13h4" />
        <path d="M10 17h4" />
      </Svg>
    );
  }

  return (
    <Svg className={className}>
      <rect x="4" y="4" width="6" height="6" rx="1.5" />
      <rect x="14" y="4" width="6" height="6" rx="1.5" />
      <rect x="4" y="14" width="6" height="6" rx="1.5" />
      <rect x="14" y="14" width="6" height="6" rx="1.5" />
    </Svg>
  );
}

export function SearchIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </Svg>
  );
}

export function BellIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M6 16h12" />
      <path d="M8 16V10a4 4 0 1 1 8 0v6" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </Svg>
  );
}

export function UserIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </Svg>
  );
}

export function ShieldIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 3 5 6v5c0 4.7 2.8 8.8 7 10 4.2-1.2 7-5.3 7-10V6l-7-3Z" />
      <path d="m9.5 12 1.7 1.7 3.5-4" />
    </Svg>
  );
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  );
}
