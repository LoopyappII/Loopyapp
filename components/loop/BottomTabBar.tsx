"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MapPin, Users, Route as RouteIcon, Siren } from "lucide-react";

const TABS = [
  { key: "mapa", label: "Mapa", Icon: MapPin },
  { key: "familia", label: "Familia", Icon: Users },
  { key: "rutas", label: "Rutas", Icon: RouteIcon },
  { key: "sos", label: "SOS", Icon: Siren },
] as const;

export default function BottomTabBar({ loopId }: { loopId: string }) {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-20 bg-white/95 backdrop-blur-md border-t border-loopy-100 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-md mx-auto grid grid-cols-4">
        {TABS.map(({ key, label, Icon }) => {
          const href = `/loop/${loopId}/${key}`;
          const active = pathname?.startsWith(href) ?? false;
          return (
            <Link
              key={key}
              href={href}
              className={`flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors ${
                active ? "text-bridge" : "text-loopy-700/60 hover:text-loopy-900"
              }`}
            >
              <Icon size={20} className={active ? "text-glow-600" : ""} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
