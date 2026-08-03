/**
 * Small, decorative inline icons. Each is purely illustrative (no independent meaning beyond the
 * text it sits next to), so every icon carries `aria-hidden`; the accessible label always lives in
 * adjacent text supplied by the caller.
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    width: 20,
    height: 20,
    "aria-hidden": true,
    ...props,
  };
}

export function ShieldCheckIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3.5 5 6v5.2c0 4.4 3 7.4 7 8.8 4-1.4 7-4.4 7-8.8V6l-7-2.5Z" />
      <path d="m9 12 2 2 4-4.2" />
    </svg>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.75" />
    </svg>
  );
}

export function MessageOffIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 5.5h13a2 2 0 0 1 2 2V13a2 2 0 0 1-2 2h-1.5" />
      <path d="M4 5.5a2 2 0 0 0-2 2V13a2 2 0 0 0 2 2h1v3l3.6-3h4.4" />
      <path d="m3 3 18 18" />
    </svg>
  );
}

export function NoteIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 3.5h9l3 3V20a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5Z" />
      <path d="M9 11h6M9 14.5h6M9 7.5h3" />
    </svg>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="1.5" />
      <path d="M3.5 9.5h17M8 3v3.5M16 3v3.5" />
    </svg>
  );
}

export function MilestoneIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 3v18" />
      <path d="M6 4.5h9.5L18 7l-2.5 2.5H6" />
    </svg>
  );
}

export function TrendIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 16.5 9.5 11l3.5 3 6-7" />
      <path d="M15.5 6.5H19V10" />
    </svg>
  );
}

export function CompassIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m14.7 9.3-2 5.4-5.4 2 2-5.4z" />
    </svg>
  );
}

export function MathIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 6h6M5 18h6M8 6v12" />
      <path d="M15 8.5c1.4-1.7 5-1.7 5 .5 0 1.6-2.2 2-2.2 3.8M17.8 16.2h.02" />
    </svg>
  );
}

export function CodeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m9 8-4.5 4L9 16" />
      <path d="m15 8 4.5 4L15 16" />
    </svg>
  );
}

export function HeritageIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3.5c2.4 2 3.6 4.3 3.6 6.8a3.6 3.6 0 0 1-7.2 0c0-2.5 1.2-4.8 3.6-6.8Z" />
      <path d="M12 13.9V20M8.5 20h7" />
    </svg>
  );
}

export function SatIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 3.5h9l3 3V20a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5Z" />
      <path d="m8.5 12 2 2 4-4.5" />
      <path d="M8 16.5h8" />
    </svg>
  );
}

export function ToeflIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.2 2.3 3.4 5.2 3.4 8.5s-1.2 6.2-3.4 8.5c-2.2-2.3-3.4-5.2-3.4-8.5S9.8 5.8 12 3.5Z" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4.5 12h15M13.5 6l6 6-6 6" />
    </svg>
  );
}
