// The brand mark, and the only drawing left in the codebase: every other icon
// now comes from lucide-react. It stays hand-written because it is also the
// source the favicons are generated from (scripts/generate-icons.py reads this
// path), so the tab icon and the header mark cannot drift apart.
export const LOGO_HEART_PATH =
  'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z';

export default function Logo({
  size = 24,
  strokeWidth = 2,
  className,
}: {
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={LOGO_HEART_PATH} />
    </svg>
  );
}
