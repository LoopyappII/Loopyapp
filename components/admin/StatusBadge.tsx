import { cn } from "@/lib/utils";
import type { SubscriptionStatus } from "@/lib/types";

// Mismas etiquetas en español que STATUS_COPY en
// app/loop/[id]/suscripcion/page.tsx (líneas 11-54) — no retraducir, solo
// reusar el texto corto para una pill.
const STATUS_LABEL: Record<SubscriptionStatus | "none", string> = {
  none: "Sin suscripción",
  incomplete: "Pago incompleto",
  incomplete_expired: "Pago expirado",
  trialing: "En prueba",
  active: "Activa",
  past_due: "Pago atrasado",
  unpaid: "Impago",
  canceled: "Cancelada",
  paused: "Pausada",
  admin_bypass: "Acceso admin",
  trialing_no_card: "Prueba sin tarjeta",
};

// green = pagando sin problemas (active/trialing real de Stripe).
// amber = transitorio/atención (trial sin tarjeta vigente, o un cobro que
// falló pero puede recuperarse) — mismo tono (amber-500) que el ícono de
// límite de velocidad en familia/page.tsx.
// red = impago sin salida fácil (unpaid, tras agotar reintentos).
// gray = terminado, sin acción posible (canceled, incomplete_expired,
// paused, sin suscripción).
// bridge = estado interno/configuración, ni éxito ni alerta (admin_bypass)
// — mismo acento que la pill "Invitado" de familia/page.tsx.
const STATUS_COLOR: Record<SubscriptionStatus | "none", string> = {
  none: "text-gray-600 bg-gray-100",
  incomplete: "text-amber-700 bg-amber-100",
  incomplete_expired: "text-gray-600 bg-gray-100",
  trialing: "text-green-700 bg-green-100",
  active: "text-green-700 bg-green-100",
  past_due: "text-amber-700 bg-amber-100",
  unpaid: "text-red-700 bg-red-100",
  canceled: "text-gray-600 bg-gray-100",
  paused: "text-gray-600 bg-gray-100",
  admin_bypass: "text-bridge bg-bridge/10",
  trialing_no_card: "text-amber-700 bg-amber-100",
};

export function StatusBadge({ status }: { status: SubscriptionStatus | null }) {
  const key = status ?? "none";
  return (
    <span
      className={cn(
        "text-[10px] font-semibold uppercase tracking-wide rounded-full px-1.5 py-0.5 shrink-0",
        STATUS_COLOR[key]
      )}
    >
      {STATUS_LABEL[key]}
    </span>
  );
}
