// One stroke family for every control icon (1.8px, round caps, 24px box).

type IconProps = { size?: number };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export function IconBack({ size = 22 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

export function IconMic({ size = 22 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </svg>
  );
}

export function IconStop({ size = 22 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconSend({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  );
}

export function IconSound({ size = 20, on }: IconProps & { on: boolean }) {
  return (
    <svg {...base(size)}>
      <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" />
      {on ? <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /> : <path d="M16 9.5l5 5M21 9.5l-5 5" />}
    </svg>
  );
}

export function IconShuffle({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M4 7h3.5c4.5 0 4.5 10 9 10H20M4 17h3.5c1.6 0 2.6-1.3 3.4-3M14 8.6C14.8 7.6 15.7 7 17 7h3M18 4.5L20.5 7 18 9.5M18 14.5l2.5 2.5-2.5 2.5" />
    </svg>
  );
}
