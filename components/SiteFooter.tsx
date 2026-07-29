import Link from "next/link";
import { HatBadge } from "./LoopyLogo";

export default function SiteFooter() {
  return (
    <footer className="flex flex-col items-center gap-2 text-center text-xs text-loopy-700/70 py-8">
      <HatBadge size={40} />
      <span className="font-semibold text-loopy-900 text-sm">Loopy</span>
      <span>LOOPER CASHLINE SL</span>
      <div className="flex gap-3 mt-1">
        <Link href="/privacidad" className="hover:text-loopy-900 transition-colors underline underline-offset-2">
          Política de privacidad
        </Link>
        <span className="text-loopy-700/30">·</span>
        <Link href="/terminos" className="hover:text-loopy-900 transition-colors underline underline-offset-2">
          Términos y condiciones
        </Link>
      </div>
    </footer>
  );
}
