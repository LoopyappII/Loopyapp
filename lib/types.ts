export type LoopMode = "mirror" | "supervision";
export type MemberRole = "admin" | "supervisor" | "tracked" | "member";

export interface Profile {
  id: string;
  name: string | null;
  avatar_url: string | null;
  phone: string | null;
  age: number | null;
}

export interface Loop {
  id: string;
  name: string;
  mode: LoopMode;
  invite_code: string;
  admin_id: string;
  created_at: string;
  speed_limit_kmh: number | null;
  emergency_number: string | null;
  primary_contact_number: string | null;
}

export interface LoopMember {
  id: string;
  loop_id: string;
  user_id: string | null;
  role: MemberRole;
  pending_name: string | null;
  pending_phone: string | null;
  member_color: string | null;
  pending_lat: number | null;
  pending_lng: number | null;
  profiles?: Profile;
}

export interface LocationRow {
  id: string;
  user_id: string;
  loop_id: string;
  lat: number;
  lng: number;
  recorded_at: string;
}

export interface SafeZone {
  id: string;
  loop_id: string;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
}

export interface SpeedAlert {
  id: string;
  loop_id: string;
  user_id: string;
  speed_kmh: number;
  limit_kmh: number;
  lat: number;
  lng: number;
  created_at: string;
}

export interface SosAlert {
  id: string;
  loop_id: string;
  user_id: string;
  lat: number;
  lng: number;
  created_at: string;
}

export type SubscriptionStatus =
  | "incomplete"
  | "incomplete_expired"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "paused"
  // Estado local, nunca viene de Stripe: un admin en la lista de
  // ADMIN_BYPASS_EMAILS (ver app/api/stripe/checkout/route.ts) que crea o
  // usa un Loopy sin pasar por el pago real. Solo para pruebas/uso interno.
  | "admin_bypass"
  // Estado local, nunca viene de Stripe: el día gratis sin tarjeta que se
  // activa al crear el primer Loopy (ver app/api/loops/start-trial/route.ts).
  // A diferencia de "trialing" (que sí viene de Stripe y ya tiene tarjeta
  // cargada), este vence de verdad — ver `trial_end` y `hasLoopAccess`.
  | "trialing_no_card";

export interface LoopSubscription {
  loop_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  status: SubscriptionStatus;
  trial_end: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

const ACCESS_GRANTING_STATUSES: SubscriptionStatus[] = ["trialing", "active", "past_due", "admin_bypass"];

// "trialing_no_card" queda deliberadamente fuera de ACCESS_GRANTING_STATUSES:
// a diferencia de los demás estados de esta lista, este vence — necesita el
// dato de tiempo (`trialEnd`), no solo el texto del estado. Agregarlo acá
// directamente haría que el trial sin tarjeta nunca terminara.
export function hasLoopAccess(
  status: SubscriptionStatus | null | undefined,
  trialEnd?: string | null
): boolean {
  if (!status) return false;
  if (status === "trialing_no_card") {
    return !!trialEnd && new Date(trialEnd) > new Date();
  }
  return ACCESS_GRANTING_STATUSES.includes(status);
}

// Para quien NO tiene acceso, decide a dónde mandarlo: /activar (nunca tuvo
// suscripción, o tuvo un trial sin tarjeta que ya venció — falta nombre +
// pago por primera vez) vs /suscripcion (ya tuvo una suscripción real de
// Stripe alguna vez — reactivar/gestionar pago, sin volver a pedir nombre).
export function needsActivation(
  status: SubscriptionStatus | null | undefined,
  trialEnd?: string | null
): boolean {
  if (!status) return true;
  if (status === "trialing_no_card") {
    return !trialEnd || new Date(trialEnd) <= new Date();
  }
  return false;
}
