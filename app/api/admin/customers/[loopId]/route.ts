import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff } from "@/lib/backofficeAuth";
import { cancelStripeSubscriptionIdempotent } from "@/lib/stripeCancel";
import { resolveStripeCustomerId } from "@/lib/stripeCustomerId";
import type { Loop, MemberRole, SubscriptionStatus } from "@/lib/types";

export interface BackofficeMemberRow {
  id: string;
  role: MemberRole;
  userId: string | null;
  name: string | null; // profiles.name si está aceptado, pending_name si no
  phone: string | null; // profiles.phone si está aceptado, pending_phone si no
  memberColor: string | null;
  isPending: boolean;
}

export interface BackofficeCustomerDetail {
  loop: Loop;
  admin: { id: string; name: string | null; phone: string | null; email: string | null };
  members: BackofficeMemberRow[];
  subscription: {
    status: SubscriptionStatus | null;
    trialEnd: string | null;
    currentPeriodEnd: string | null;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    isRealStripeCustomer: boolean; // true solo si stripeCustomerId empieza con "cus_"
  };
}

async function loadDetail(loopId: string): Promise<BackofficeCustomerDetail | null> {
  const { data: loop, error: loopError } = await supabaseAdmin
    .from("loops")
    .select("*")
    .eq("id", loopId)
    .single();
  if (loopError || !loop) return null;

  const { data: adminProfile, error: adminProfileError } = await supabaseAdmin
    .from("profiles")
    .select("id, name, phone")
    .eq("id", loop.admin_id)
    .maybeSingle();
  if (adminProfileError) {
    throw new Error(adminProfileError.message);
  }
  const { data: adminAuth } = await supabaseAdmin.auth.admin.getUserById(loop.admin_id);

  // Mismo hint de FK que app/loop/[id]/layout.tsx usa para este mismo join
  // (loop_members -> profiles vía user_id) — evita un error de relación
  // ambigua en PostgREST.
  const { data: memberRows, error: memberRowsError } = await supabaseAdmin
    .from("loop_members")
    .select(
      "id, role, user_id, pending_name, pending_phone, member_color, profiles!loop_members_user_id_fkey(name, phone)"
    )
    .eq("loop_id", loopId);
  if (memberRowsError) {
    throw new Error(memberRowsError.message);
  }

  const members: BackofficeMemberRow[] = (memberRows || []).map((m: any) => ({
    id: m.id,
    role: m.role,
    userId: m.user_id,
    name: m.user_id ? (m.profiles?.name ?? null) : (m.pending_name ?? null),
    phone: m.user_id ? (m.profiles?.phone ?? null) : (m.pending_phone ?? null),
    memberColor: m.member_color,
    isPending: !m.user_id,
  }));

  const { data: sub, error: subError } = await supabaseAdmin
    .from("loop_subscriptions")
    .select("status, trial_end, current_period_end, stripe_customer_id, stripe_subscription_id")
    .eq("loop_id", loopId)
    .maybeSingle();
  if (subError) {
    throw new Error(subError.message);
  }

  return {
    loop: loop as Loop,
    admin: {
      id: loop.admin_id,
      name: adminProfile?.name ?? null,
      phone: adminProfile?.phone ?? null,
      email: adminAuth.user?.email ?? null,
    },
    members,
    subscription: {
      status: (sub?.status as SubscriptionStatus | undefined) ?? null,
      trialEnd: sub?.trial_end ?? null,
      currentPeriodEnd: sub?.current_period_end ?? null,
      stripeCustomerId: sub?.stripe_customer_id ?? null,
      stripeSubscriptionId: sub?.stripe_subscription_id ?? null,
      isRealStripeCustomer: !!resolveStripeCustomerId(sub?.stripe_customer_id),
    },
  };
}

export async function GET(req: NextRequest, { params }: { params: { loopId: string } }) {
  const auth = await requireStaff(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  let detail: BackofficeCustomerDetail | null;
  try {
    detail = await loadDetail(params.loopId);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
  if (!detail) {
    return NextResponse.json({ error: "Loopy no encontrado" }, { status: 404 });
  }
  return NextResponse.json(detail);
}

// Tablas hijas que referencian loops.id DIRECTAMENTE (tienen su propia
// columna loop_id) y deben limpiarse antes de borrar el Loopy. SOLO
// loop_subscriptions tiene "on delete cascade" confirmado en los specs del
// repo (docs/superpowers/specs/2026-08-31-loop-subscriptions.sql) — nunca
// se verificó si las demás lo tienen también, y nunca se ha borrado un
// Loopy en este código (confirmado: un único .delete() en todo el repo, y
// es de una zona segura). Por eso este borrado es EXPLÍCITO tabla por
// tabla en vez de confiar en una cascada no verificada. Es inofensivo si
// alguna tabla ya tenía cascade — simplemente borra 0 filas la segunda
// vez.
//
// zone_events NO está en esta lista a propósito: NO tiene columna loop_id
// propia — se relaciona con el Loopy solo de forma indirecta, vía
// zone_id -> safe_zones.loop_id (confirmado leyendo
// app/loop/[id]/layout.tsx: el insert de zone_events solo escribe
// zone_id/user_id/event_type, nunca loop_id; el select lo filtra vía un
// embed ".eq('safe_zones.loop_id', loopId)", no una columna propia; y
// lib/types.ts no tiene ninguna interfaz zone_events, a diferencia de
// TODAS las demás tablas hijas que sí declaran loop_id). Un
// ".eq('loop_id', loopId)" directo contra zone_events fallaría con
// "column does not exist" en cada intento — se maneja aparte, resolviendo
// primero los ids de safe_zones del Loopy.
//
// loop_subscriptions TAMPOCO está en esta lista, pero por una razón
// distinta: sí tiene loop_id propio, pero su borrado se maneja aparte,
// DESPUÉS de intentar cancelar la suscripción en Stripe (ver DELETE más
// abajo). Si loop_subscriptions se borrara acá, en este loop, se perdería
// para siempre el stripe_subscription_id necesario para cancelar
// manualmente en el Dashboard de Stripe en caso de que el cancel
// automático falle — exactamente el escenario que este orden evita.
const CHILD_TABLES_BY_LOOP_ID = [
  "sos_alerts",
  "speed_alerts",
  "locations",
  "safe_zones",
  "loop_members",
] as const;

export async function DELETE(req: NextRequest, { params }: { params: { loopId: string } }) {
  const auth = await requireStaff(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const loopId = params.loopId;

  // Guardamos los datos de Stripe ANTES de borrar nada — pero no los
  // usamos todavía. A propósito, el cancel de Stripe se hace recién al
  // final, después de que TODA la limpieza de tablas hijas haya
  // funcionado: así, si cualquier paso de abajo falla, no cancelamos una
  // suscripción real de un cliente por un Loopy que en los hechos no se
  // terminó de borrar.
  //
  // Si esta query falla (error real, no "no rows"), NO seguimos: un `sub`
  // undefined por un error transitorio haría que `resolveStripeCustomerId`
  // dé falsy y el cancel de Stripe se salte por completo, procediendo a
  // borrar todo (incluido el Loopy) sin haber intentado cancelar una
  // suscripción real.
  const { data: sub, error: subError } = await supabaseAdmin
    .from("loop_subscriptions")
    .select("stripe_customer_id, stripe_subscription_id")
    .eq("loop_id", loopId)
    .maybeSingle();
  if (subError) {
    return NextResponse.json({ error: subError.message }, { status: 500 });
  }

  // zone_events se relaciona con el Loopy solo vía zone_id ->
  // safe_zones.loop_id (ver comentario de CHILD_TABLES_BY_LOOP_ID) — hay
  // que resolver los ids de zona de este Loopy antes de poder borrar sus
  // eventos.
  const { data: zoneRows, error: zoneRowsError } = await supabaseAdmin
    .from("safe_zones")
    .select("id")
    .eq("loop_id", loopId);
  if (zoneRowsError) {
    return NextResponse.json({ error: zoneRowsError.message }, { status: 500 });
  }
  const zoneIds = (zoneRows || []).map((z) => z.id as string);
  if (zoneIds.length > 0) {
    const { error: zoneEventsError } = await supabaseAdmin
      .from("zone_events")
      .delete()
      .in("zone_id", zoneIds);
    if (zoneEventsError) {
      return NextResponse.json({ error: zoneEventsError.message }, { status: 500 });
    }
  }

  for (const table of CHILD_TABLES_BY_LOOP_ID) {
    const { error } = await supabaseAdmin.from(table).delete().eq("loop_id", loopId);
    if (error) {
      return NextResponse.json(
        { error: `No se pudo limpiar ${table} antes de borrar el Loopy: ${error.message}` },
        { status: 500 }
      );
    }
  }

  // Recién acá, con TODA la limpieza de arriba ya confirmada, tocamos
  // Stripe. loop_subscriptions TODAVÍA no se borró (ver comentario de
  // CHILD_TABLES_BY_LOOP_ID) — si el cancel falla de verdad (no
  // "resource_missing"), abortamos ACÁ, antes de borrar loop_subscriptions
  // o loops, para no perder el stripe_subscription_id que hace falta para
  // cancelar manualmente.
  //
  // Mismo filtro de "¿es un id real de Stripe?" que
  // app/api/stripe/checkout/route.ts ya usa — si es sintético
  // (trial_no_card_<id> / admin_bypass_<id>), no hay nada que cancelar en
  // Stripe.
  const isRealStripeSubscription = !!resolveStripeCustomerId(sub?.stripe_customer_id);
  if (isRealStripeSubscription && sub?.stripe_subscription_id) {
    const cancelResult = await cancelStripeSubscriptionIdempotent(sub.stripe_subscription_id);
    if (!cancelResult.ok) {
      return NextResponse.json(
        {
          error: `No se pudo cancelar ${sub.stripe_subscription_id} en Stripe, se abortó el borrado del Loopy: ${cancelResult.error}`,
        },
        { status: 500 }
      );
    }
  }

  // Solo acá, con el cancel de Stripe exitoso (o nada real que cancelar),
  // borramos loop_subscriptions y recién después la fila de loops.
  const { error: subDeleteError } = await supabaseAdmin
    .from("loop_subscriptions")
    .delete()
    .eq("loop_id", loopId);
  if (subDeleteError) {
    return NextResponse.json(
      { error: `No se pudo limpiar loop_subscriptions antes de borrar el Loopy: ${subDeleteError.message}` },
      { status: 500 }
    );
  }

  const { error: deleteError } = await supabaseAdmin.from("loops").delete().eq("id", loopId);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
