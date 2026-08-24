"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MapPin, Users, Route as RouteIcon, Siren } from "lucide-react";
import { HatBadge } from "@/components/LoopyLogo";

const TABS = [
  { key: "mapa", label: "Mapa", Icon: MapPin },
  { key: "familia", label: "Familia", Icon: Users },
  { key: "rutas", label: "Rutas", Icon: RouteIcon },
  { key: "sos", label: "SOS", Icon: Siren },
] as const;

export default function BottomTabBar({ loopId }: { loopId: string }) {
  const pathname = usePathname();

  return (
    <nav
      className="sticky bottom-0 z-20 bg-white/95 backdrop-blur-md border-t border-loopy-100 pb-[env(safe-area-inset-bottom)]
                 md:order-first md:sticky md:top-0 md:bottom-auto md:h-screen md:w-56 md:shrink-0 md:border-t-0 md:border-r md:border-loopy-900/20 md:pb-0
                 md:bg-gradient-to-b md:from-loopy-900 md:to-bridge/90"
    >
      <div className="hidden md:flex md:items-center md:gap-2 md:px-5 md:pt-6 md:pb-5">
        <HatBadge size={30} />
        <span className="text-white font-extrabold tracking-tight">Loopy</span>
      </div>
      <div className="max-w-md mx-auto grid grid-cols-4 md:max-w-none md:mx-0 md:flex md:flex-col md:gap-1 md:px-3">
        {TABS.map(({ key, label, Icon }) => {
          const href = `/loop/${loopId}/${key}`;
          const active = pathname?.startsWith(href) ?? false;
          return (
            <Link
              key={key}
              href={href}
              className={`flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors
                          md:flex-row md:justify-start md:gap-3 md:px-3 md:py-2.5 md:rounded-xl md:text-sm ${
                active
                  ? "text-bridge md:bg-white/15 md:text-white"
                  : "text-loopy-700/60 hover:text-loopy-900 md:text-white/70 md:hover:bg-white/10 md:hover:text-white"
              }`}
            >
              <Icon size={20} className={active ? "text-glow-600 md:text-glow-400" : "md:text-white/70"} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
