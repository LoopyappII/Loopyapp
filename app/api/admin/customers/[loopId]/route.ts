import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff } from "@/lib/backofficeAuth";
import { stripe } from "@/lib/stripeClient";
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

  const { data: adminProfile } = await supabaseAdmin
    .from("profiles")
    .select("id, name, phone")
    .eq("id", loop.admin_id)
    .maybeSingle();
  const { data: adminAuth } = await supabaseAdmin.auth.admin.getUserById(loop.admin_id);

  // Mismo hint de FK que app/loop/[id]/layout.tsx usa para este mismo join
  // (loop_members -> profiles vía user_id) — evita un error de relación
  // ambigua en PostgREST.
  const { data: memberRows } = await supabaseAdmin
    .from("loop_members")
    .select(
      "id, role, user_id, pending_name, pending_phone, member_color, profiles!loop_members_user_id_fkey(name, phone)"
    )
    .eq("loop_id", loopId);

  const members: BackofficeMemberRow[] = (memberRows || []).map((m: any) => ({
    id: m.id,
    role: m.role,
    userId: m.user_id,
    name: m.user_id ? (m.profiles?.name ?? null) : (m.pending_name ?? null),
    phone: m.user_id ? (m.profiles?.phone ?? null) : (m.pending_phone ?? null),
    memberColor: m.member_color,
    isPending: !m.user_id,
  }));

  const { data: sub } = await supabaseAdmin
    .from("loop_subscriptions")
    .select("status, trial_end, current_period_end, stripe_customer_id, stripe_subscription_id")
    .eq("loop_id", loopId)
    .maybeSingle();

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
  const detail = await loadDetail(params.loopId);
  if (!detail) {
    return NextResponse.json({ error: "Loopy no encontrado" }, { status: 404 });
  }
  return NextResponse.json(detail);
}

// Tablas hijas que referencian loops.id y deben limpiarse antes de borrar
// el Loopy. SOLO loop_subscriptions tiene "on delete cascade" confirmado
// en los specs del repo (docs/superpowers/specs/2026-08-31-loop-subscriptions.sql)
// — nunca se verificó si las demás lo tienen también, y nunca se ha
// borrado un Loopy en este código (confirmado: un único .delete() en todo
// el repo, y es de una zona segura). Por eso este borrado es EXPLÍCITO
// tabla por tabla en vez de confiar en una cascada no verificada. Es
// inofensivo si alguna tabla ya tenía cascade — simplemente borra 0 filas
// la segunda vez.
const CHILD_TABLES = [
  "zone_events",
  "sos_alerts",
  "speed_alerts",
  "locations",
  "safe_zones",
  "loop_members",
  "loop_subscriptions",
] as const;

export async function DELETE(req: NextRequest, { params }: { params: { loopId: string } }) {
  const auth = await requireStaff(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const loopId = params.loopId;

  const { data: sub } = await supabaseAdmin
    .from("loop_subscriptions")
    .select("stripe_customer_id, stripe_subscription_id")
    .eq("loop_id", loopId)
    .maybeSingle();

  // Mismo filtro de "¿es un id real de Stripe?" que
  // app/api/stripe/checkout/route.ts ya usa — si es sintético
  // (trial_no_card_<id> / admin_bypass_<id>), no hay nada que cancelar en
  // Stripe.
  const isRealStripeSubscription = !!resolveStripeCustomerId(sub?.stripe_customer_id);
  if (isRealStripeSubscription && sub?.stripe_subscription_id) {
    try {
      await stripe.subscriptions.cancel(sub.stripe_subscription_id);
    } catch (err) {
      // Si Stripe ya no la tiene (p.ej. se canceló por otra vía antes), no
      // bloqueamos el borrado del Loopy por eso — solo lo logueamos.
      console.warn(
        `No se pudo cancelar ${sub.stripe_subscription_id} en Stripe antes de borrar el Loopy ${loopId}:`,
        err
      );
    }
  }

  for (const table of CHILD_TABLES) {
    const { error } = await supabaseAdmin.from(table).delete().eq("loop_id", loopId);
    if (error) {
      return NextResponse.json(
        { error: `No se pudo limpiar ${table} antes de borrar el Loopy: ${error.message}` },
        { status: 500 }
      );
    }
  }

  const { error: deleteError } = await supabaseAdmin.from("loops").delete().eq("id", loopId);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
