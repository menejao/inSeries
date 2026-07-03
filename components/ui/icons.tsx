import type { SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement>;

/**
 * Small hand-rolled icon set (Lucide-ish stroke style) so the app isn't
 * dependent on an icon package. Every icon is 24x24, stroke-based, and
 * inherits `currentColor` — size/color are controlled by the consumer via
 * className (e.g. `h-5 w-5 text-muted`).
 */
function createIcon(paths: React.ReactNode) {
  return function Icon({ className, ...props }: IconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
        {...props}
      >
        {paths}
      </svg>
    );
  };
}

export const HomeIcon = createIcon(
  <>
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9" />
  </>
);

export const TvIcon = createIcon(
  <>
    <rect x="3" y="6" width="18" height="13" rx="2.5" />
    <path d="M8 21h8M9 3l3 3 3-3" />
  </>
);

export const CompassIcon = createIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M14.8 9.2 13 13l-3.8 1.8L11 11l3.8-1.8Z" />
  </>
);

export const SearchIcon = createIcon(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </>
);

export const CalendarIcon = createIcon(
  <>
    <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
    <path d="M3.5 9.5h17M8 3v3M16 3v3" />
  </>
);

export const ListIcon = createIcon(
  <>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <path d="M4 6h.01M4 12h.01M4 18h.01" />
  </>
);

export const UserIcon = createIcon(
  <>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M4.5 20c1.4-3.6 4.4-5.5 7.5-5.5s6.1 1.9 7.5 5.5" />
  </>
);

export const BellIcon = createIcon(
  <>
    <path d="M6 9a6 6 0 1 1 12 0c0 3.2 1 5 1.6 6H4.4C5 14 6 12.2 6 9Z" />
    <path d="M10 19a2 2 0 0 0 4 0" />
  </>
);

export const SettingsIcon = createIcon(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 13.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V19.9a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.04H4.1a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.56-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.05A1.7 1.7 0 0 0 11.2 4.1V4a2 2 0 1 1 4 0v.09c0 .68.4 1.29 1.04 1.56h.05a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.05c.27.64.88 1.07 1.56 1.07H19.9a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1.04Z" />
  </>
);

export const SunIcon = createIcon(
  <>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 3v2M12 19v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M3 12h2M19 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
  </>
);

export const MoonIcon = createIcon(<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />);

export const ChevronDownIcon = createIcon(<path d="m6 9 6 6 6-6" />);
export const ChevronLeftIcon = createIcon(<path d="m15 18-6-6 6-6" />);
export const ChevronRightIcon = createIcon(<path d="m9 18 6-6-6-6" />);

export const XIcon = createIcon(<path d="M18 6 6 18M6 6l12 12" />);

export const CheckIcon = createIcon(<path d="M5 12.5l4.5 4.5L19 7" />);

export const CheckCircleIcon = createIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12.5 2.4 2.4L16 9.5" />
  </>
);

export const AlertCircleIcon = createIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5M12 16h.01" />
  </>
);

export const InfoIcon = createIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </>
);

export const PlusIcon = createIcon(<path d="M12 5v14M5 12h14" />);

export const MoreHorizontalIcon = createIcon(
  <path d="M5 12h.01M12 12h.01M19 12h.01" strokeWidth={2.75} />
);

export const LogOutIcon = createIcon(
  <>
    <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" />
    <path d="M16 17l5-5-5-5M21 12H9" />
  </>
);

export const ShieldIcon = createIcon(
  <path d="M12 3.5 19.5 6.5V11.5C19.5 16.5 16 19.7 12 21C8 19.7 4.5 16.5 4.5 11.5V6.5L12 3.5Z" />
);

export const StarIcon = createIcon(
  <path d="M12 3.5 14.6 9l6.1.6-4.6 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6-4.6-4.1L9.4 9 12 3.5Z" />
);

export const PlayIcon = createIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="m10 9 5 3-5 3Z" />
  </>
);

export const MenuIcon = createIcon(<path d="M4 7h16M4 12h16M4 17h16" />);

export const LoaderIcon = createIcon(<path d="M12 3v3M12 18v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M3 12h3M18 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />);

export const InboxIcon = createIcon(
  <>
    <path d="M4 12.5 6.5 5h11L20 12.5" />
    <path d="M4 12.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5.5h-4.8a2.2 2.2 0 0 1-2 1.2h-2.4a2.2 2.2 0 0 1-2-1.2H4Z" />
  </>
);

export const FilmIcon = createIcon(
  <>
    <rect x="3.5" y="4" width="17" height="16" rx="2" />
    <path d="M3.5 9h17M3.5 15h17M8.5 4v5M8.5 15v5M15.5 4v5M15.5 15v5" />
  </>
);

export const HeartIcon = createIcon(
  <path d="M12 20.2S3.8 15.2 3.8 9.4a4.6 4.6 0 0 1 8.2-2.9 4.6 4.6 0 0 1 8.2 2.9c0 5.8-8.2 10.8-8.2 10.8Z" />
);

export const TrashIcon = createIcon(
  <>
    <path d="M4 7h16M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2" />
    <path d="M6.5 7 7.3 19a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9L17.5 7" />
  </>
);

export const EyeOffIcon = createIcon(
  <>
    <path d="M3 3l18 18" />
    <path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c5 0 9 3.5 10 7-0.4 1.3-1.1 2.6-2.1 3.7M6.5 6.6C4.6 7.9 3.1 9.7 2 12c1 3.5 5 7 10 7 1.4 0 2.7-0.3 3.9-0.7" />
    <path d="M9.9 10a3 3 0 0 0 4.2 4.2" />
  </>
);

export const PencilIcon = createIcon(
  <path d="M4 20h4L19.5 8.5a2 2 0 0 0 0-2.8L18.3 4.5a2 2 0 0 0-2.8 0L4 16v4Z" />
);
