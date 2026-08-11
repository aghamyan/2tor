import type { SVGProps } from "react";

export type CourseIconKey = "math" | "programming" | "armenian" | "chess";

type CourseIconProps = SVGProps<SVGSVGElement> & { course: CourseIconKey };

function frame(props: SVGProps<SVGSVGElement>) {
  return {
    "aria-hidden": true,
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.45,
    viewBox: "0 0 48 48",
    ...props,
  };
}

function Mathematics(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...frame(props)}>
      <circle cx="24" cy="24" r="18.25" fill="currentColor" fillOpacity=".08" strokeOpacity=".28" />
      <path d="M12 31.5c5.1-15.1 11.2-17.8 24-13.4" />
      <path d="M15 16.5h6M18 13.5v6" strokeWidth="1.8" />
      <path d="M31.5 29.5h6M34.5 26.5v6" strokeWidth="1.8" />
      <circle cx="25.2" cy="18.3" r="2.45" fill="currentColor" stroke="none" />
    </svg>
  );
}

function Programming(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...frame(props)}>
      <rect x="6.5" y="7" width="35" height="34" rx="12" fill="currentColor" fillOpacity=".08" strokeOpacity=".28" />
      <path d="m18.2 18-6 6 6 6M29.8 18l6 6-6 6M26.7 15.7l-5.4 16.6" />
      <circle cx="14" cy="13.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="18.3" cy="13.5" r="1.3" fill="currentColor" fillOpacity=".55" stroke="none" />
    </svg>
  );
}

function Armenian(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...frame(props)}>
      <path d="M24 6.5c9.7 4.2 14.7 11.4 14.7 20.1 0 8.2-6.5 14.9-14.7 14.9S9.3 34.8 9.3 26.6C9.3 17.9 14.3 10.7 24 6.5Z" fill="currentColor" fillOpacity=".08" strokeOpacity=".28" />
      <path d="M17.2 33.8 24 15l6.8 18.8M20.1 27.3h7.8" />
      <path d="M14.2 17.1c2.3-2.2 4.8-3.8 7.5-4.8M33.8 17.1c-2.3-2.2-4.8-3.8-7.5-4.8" strokeOpacity=".62" />
      <circle cx="24" cy="9.5" r="1.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function Chess(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...frame(props)}>
      <path d="M15.2 37.8h17.6M17.4 33.4h13.2l-1.8-6.2c-.6-2.1.3-4.1 2.4-5.4l2.1-1.3-2.3-9.8-7.4-3.2-8.2 6.6 3.2 5.7c1.1 2 .7 4.2-.8 5.9l-2.3 2.5Z" fill="currentColor" fillOpacity=".08" strokeOpacity=".35" />
      <path d="M18.6 14.1c2.2 1 4.7.8 6.6-.8l2-1.7M22 22.3h5.5" />
      <circle cx="25.8" cy="15.1" r="1.15" fill="currentColor" stroke="none" />
      <path d="M13.1 37.8h21.8" strokeWidth="1.8" />
    </svg>
  );
}

export function CourseIcon({ course, ...props }: CourseIconProps) {
  const Icon = { math: Mathematics, programming: Programming, armenian: Armenian, chess: Chess }[course];
  return <Icon {...props} />;
}
