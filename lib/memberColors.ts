export interface MemberColorOption {
  slug: string;
  from: string;
  to: string;
}

// All 6 pairs are built only from colors already defined in
// tailwind.config (loopy/glow/bridge) — no new hex values.
export const MEMBER_COLOR_OPTIONS: MemberColorOption[] = [
  { slug: "loopy-bridge", from: "#3d4a8a", to: "#834c9c" },
  { slug: "bridge-glow", from: "#834c9c", to: "#ec6fc9" },
  { slug: "loopy-glow", from: "#5b6fc4", to: "#ec6fc9" },
  { slug: "glow-soft", from: "#c94fae", to: "#f6b8e8" },
  { slug: "loopy-deep", from: "#232a52", to: "#4b58a8" },
  { slug: "bridge-soft", from: "#6d3f83", to: "#a06bb8" },
];

export function getMemberGradient(slug: string | null | undefined): string {
  const option = MEMBER_COLOR_OPTIONS.find((o) => o.slug === slug) ?? MEMBER_COLOR_OPTIONS[0];
  return `linear-gradient(135deg, ${option.from}, ${option.to})`;
}
