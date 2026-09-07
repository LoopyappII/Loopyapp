export interface MemberColorOption {
  slug: string;
  from: string;
  to: string;
}

// All colors are already defined in tailwind.config (loopy/glow/bridge)
// — no new hex values.
//
// Los 3 tonos de marca (loopy, bridge, glow) caen todos en un arco de
// apenas ~90° de matiz (azul ~231°, violeta ~284°, rosa ~317° — nada de
// verde/amarillo/naranja). Un degradé diagonal entre dos de esos tonos
// se percibe, a 32px, como el promedio de ambos: casi todas las
// combinaciones cruzadas terminan viéndose del mismo violeta apagado,
// que es exactamente el problema que reportó el cliente. La solución
// no es más degradés cruzados — es usar cada tono **sólido** (from ===
// to) y aprovechar el rango de luminosidad *dentro* de cada familia
// (azul: de marino oscuro a celeste medio; rosa: de rosa pálido a
// magenta fuerte; violeta: claro y oscuro) para que el matiz, no un
// blend, sea lo que distingue un avatar de otro.
//
// Los slugs viejos (los primeros 6) se mantienen tal cual para no
// romper el member_color ya guardado en loop_members de miembros
// reales/pendientes creados antes de este cambio — solo se les
// reasignó un color más distintivo.
export const MEMBER_COLOR_OPTIONS: MemberColorOption[] = [
  { slug: "loopy-bridge", from: "#232a52", to: "#232a52" }, // azul marino
  { slug: "bridge-glow", from: "#c94fae", to: "#c94fae" }, // magenta profundo
  { slug: "loopy-glow", from: "#5b6fc4", to: "#5b6fc4" }, // azul medio
  { slug: "glow-soft", from: "#f6b8e8", to: "#f6b8e8" }, // rosa pálido
  { slug: "loopy-deep", from: "#3d4a8a", to: "#3d4a8a" }, // azul oscuro
  { slug: "bridge-soft", from: "#a06bb8", to: "#a06bb8" }, // violeta claro
  { slug: "loopy-mid", from: "#4b58a8", to: "#4b58a8" }, // azul-violeta
  { slug: "glow-mid", from: "#ec6fc9", to: "#ec6fc9" }, // rosa vívido
  { slug: "bridge-deep", from: "#6d3f83", to: "#6d3f83" }, // violeta oscuro
];

export function getMemberGradient(slug: string | null | undefined): string {
  const option = MEMBER_COLOR_OPTIONS.find((o) => o.slug === slug) ?? MEMBER_COLOR_OPTIONS[0];
  return `linear-gradient(135deg, ${option.from}, ${option.to})`;
}
