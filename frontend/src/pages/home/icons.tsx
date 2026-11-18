import type { ReactNode, SVGProps } from "react";

// Small stroke icons for the Home Page (24 x 24 grid, currentColor), drawn in the same
// line style as the reference. No icon library: the page needs about a dozen.

function Icon({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

type P = SVGProps<SVGSVGElement>;

export const UserIcon = (p: P) => (
  <Icon {...p}>
    <circle cx="12" cy="8" r="3.8" />
    <path d="M4.5 20.5v-1a5 5 0 0 1 5-5h5a5 5 0 0 1 5 5v1" />
  </Icon>
);
export const ArrowIcon = (p: P) => (
  <Icon {...p}>
    <path d="M4 12h15M13 6l6 6-6 6" />
  </Icon>
);
export const StethoscopeIcon = (p: P) => (
  <Icon {...p}>
    <path d="M6 3H5a1.5 1.5 0 0 0-1.5 1.5v4a5.5 5.5 0 0 0 11 0v-4A1.5 1.5 0 0 0 13 3h-1" />
    <path d="M9 14v1.5a4.5 4.5 0 0 0 9 0V13" />
    <circle cx="18" cy="11" r="2" />
  </Icon>
);
export const PeopleIcon = (p: P) => (
  <Icon {...p}>
    <circle cx="8" cy="8" r="3" />
    <path d="M2.5 19v-1.5a4 4 0 0 1 4-4h3a4 4 0 0 1 4 4V19" />
    <circle cx="17" cy="9" r="2.4" />
    <path d="M16 13.7h1.2a3.6 3.6 0 0 1 3.6 3.6V19" />
  </Icon>
);
export const NewbornIcon = (p: P) => (
  <Icon {...p}>
    <path d="M12 3c-4 0-6.5 3-6.5 7 0 3.2 1.2 5 2.2 6.6.9 1.4 1.6 3.4 4.3 3.4s3.4-2 4.3-3.4c1-1.6 2.2-3.4 2.2-6.6 0-4-2.5-7-6.5-7Z" />
    <circle cx="9.7" cy="10.2" r=".7" fill="currentColor" />
    <circle cx="14.3" cy="10.2" r=".7" fill="currentColor" />
    <path d="M10.2 13.4c.9.8 2.7.8 3.6 0" />
  </Icon>
);
export const BarsIcon = (p: P) => (
  <Icon {...p}>
    <rect x="3" y="14" width="4.6" height="7" rx="1.2" />
    <rect x="9.7" y="9" width="4.6" height="12" rx="1.2" />
    <rect x="16.4" y="3" width="4.6" height="18" rx="1.2" />
  </Icon>
);
export const ClipboardIcon = (p: P) => (
  <Icon {...p}>
    <rect x="8" y="2.5" width="8" height="4" rx="1.2" />
    <path d="M16 4.5h2a2 2 0 0 1 2 2V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2h2" />
    <path d="M11.5 11H16M11.5 16H16M8 11h.01M8 16h.01" />
  </Icon>
);
export const BellIcon = (p: P) => (
  <Icon {...p}>
    <path d="M6 9a6 6 0 0 1 12 0c0 6.5 2.6 8.5 2.6 8.5H3.4S6 15.5 6 9Z" />
    <path d="M10.2 21a2 2 0 0 0 3.6 0" />
  </Icon>
);
export const AlertTriangleIcon = (p: P) => (
  <Icon {...p} strokeWidth={0} fill="currentColor">
    <path d="M10.3 3.9 2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4.6M12 16.4v.1" stroke="#fff" strokeWidth={2} />
  </Icon>
);
export const ReplayIcon = (p: P) => (
  <Icon {...p}>
    <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5" />
    <path d="M3.5 3.5v5h5" />
  </Icon>
);
export const HeartIcon = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
    <path
      d="M12 21.2 10.6 19.9C5.6 15.4 2.4 12.5 2.4 8.9 2.4 6 4.6 3.8 7.5 3.8c1.6 0 3.2.8 4.5 2.1 1.3-1.3 2.9-2.1 4.5-2.1 2.9 0 5.1 2.2 5.1 5.1 0 3.6-3.2 6.5-8.2 11L12 21.2Z"
      fill="currentColor"
    />
  </svg>
);

/** The little fetus inside each trimester circle; `size` grows with the trimester. */
export function FetusGlyph({ size = 1 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" style={{ transform: `scale(${size})` }}>
      <defs>
        <linearGradient id="glyph-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8fcdb0" />
          <stop offset="1" stopColor="#4f9b7e" />
        </linearGradient>
      </defs>
      <g fill="url(#glyph-g)">
        <circle cx="29" cy="15.5" r="8.6" />
        <path d="M22 21c7 0 12 5 11.4 11.6-.5 6-6 9.6-12 8.4-4.600-.9-8.400-4.600-8.400-8.600 0-1.800.8-3.300 2-4.200 1.400-1 3.400-1 4.700-2.800.8-1.100 1.300-2.800 2.300-4.400Z" />
        <circle cx="14.500" cy="38" r="3.400" />
      </g>
    </svg>
  );
}

/** Swaddled newborn for the last milestone (white on the dark circle). */
export function NewbornGlyph() {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      fill="none"
      stroke="#fff"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M24 6c-6 0-9.500 4.400-9.500 10 0 2.400.7 4.200 1.500 5.600L12 32c-1.200 5 2 9.500 7 10h10c5-.5 8.200-5 7-10l-4-10.400c.8-1.400 1.500-3.200 1.500-5.600 0-5.600-3.500-10-9.500-10Z" />
      <circle cx="20.500" cy="16" r=".9" fill="#fff" />
      <circle cx="27.500" cy="16" r=".9" fill="#fff" />
      <path d="M21 20c1.800 1.400 4.200 1.400 6 0" />
      <path d="M16.500 27c3 2.200 12 2.200 15 0M14 33c4.500 2.400 15.500 2.400 20 0" />
    </svg>
  );
}

/** Logo mark: a mother in profile cradling her baby, traced from the reference (line art). */
export function LogoMark() {
  return (
    <svg
      viewBox="28 34 428 530"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={13}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* hair and back: the big outer sweep, then its inner edge */}
      <path d="M352 176C352 110 310 50 240 46 170 44 118 110 84 200 54 280 36 352 62 430c30 85 108 122 190 118 78-4 146-48 180-112 10-20 12-40 8-62" />
      <path d="M205 182C150 214 98 276 66 352c-12 40-6 84 18 120" />
      {/* hairline, face profile, neck and shoulder */}
      <path d="M206 182c44-22 94-30 132-34" />
      <path d="M338 148c12 8 16 22 12 34-6 14-18 22-20 32 4 12-4 22-16 26 4 10-6 22-22 28-16 6-30 0-38-6" />
      <path d="M254 262c-30 0-48 16-44 38 4 30 30 60 58 100" />
      {/* the arm that holds the baby */}
      <path d="M178 368c4 32 28 72 84 98 48 18 104 4 138-26" />
      {/* baby: head, ear and the swaddle edge */}
      <path d="M304 392c-8-32 18-74 64-80 46-6 78 28 74 72-2 26-22 42-48 44" />
      <path d="M304 392c2 18 14 28 30 26" />
      <path d="M396 428c12 12 12 28 4 42" />
    </svg>
  );
}
