import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff } from "@/lib/backofficeAuth";
import type { SubscriptionStatus, LoopMode } from "@/lib/types";

export interface BackofficeCustomerRow {
  loopId: string;
  loopName: string;
  mode: LoopMode;
  createdAt: string;
  adminId: string;
  adminName: string | null;
  adminEmail: string | null;
  memberCountActive: number;
  memberCountPending: number;
  subscriptionStatus: SubscriptionStatus | null;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
}

export async function GET(req: NextRequest) {
  const auth = await requireStaff(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data: loops, error: loopsError } = await supabaseAdmin
    .from("loops")
    .select("id, name, mode, admin_id, created_at")
    .order("created_at", { ascending: false });
  if (loopsError) {
    return NextResponse.json({ error: loopsError.message }, { status: 500 });
  }
  const loopRows = loops || [];
  if (loopRows.length === 0) {
    return NextResponse.json({ customers: [] as BackofficeCustomerRow[] });
  }
  const loopIds = loopRows.map((l) => l.id as string);

  const { data: subs, error: subsError } = await supabaseAdmin
    .from("loop_subscriptions")
    .select("loop_id, stripe_customer_id, status, trial_end, current_period_end")
    .in("loop_id", loopIds);
  if (subsError) {
    return NextResponse.json({ error: subsError.message }, { status: 500 });
  }
  const subByLoop = new Map((subs || []).map((s) => [s.loop_id as string, s]));

  const { data: members, error: membersError } = await supabaseAdmin
    .from("loop_members")
    .select("loop_id, user_id")
    .in("loop_id", loopIds);
  if (membersError) {
    return NextResponse.json({ error: membersError.message }, { status: 500 });
  }
  const activeCountByLoop = new Map<string, number>();
  const pendingCountByLoop = new Map<string, number>();
  for (const m of members || []) {
    const map = m.user_id ? activeCountByLoop : pendingCountByLoop;
    map.set(m.loop_id as string, (map.get(m.loop_id as string) || 0) + 1);
  }

  // profiles tiene nombre pero NO email (solo vive en Supabase Auth,
  // alcanzable vía supabaseAdmin.auth.admin.getUserById, nunca con un
  // select plano). Resolvemos el email de cada admin DISTINTO con una
  // llamada por admin — O(admins distintos), no O(loops): un mismo admin
  // con varios Loopys cuesta una sola llamada. Aceptable con el volumen de
  // clientes de hoy; si la base crece mucho, cambiar a
  // supabaseAdmin.auth.admin.listUsers() paginado + un Map en memoria —
  // deliberadamente fuera de alcance en este plan.
  const distinctAdminIds = Array.from(new Set(loopRows.map((l) => l.admin_id as string)));
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, name")
    .in("id", distinctAdminIds);
  const profileById = new Map((profiles || []).map((p) => [p.id as string, p]));

  const emailByAdminId = new Map<string, string | null>();
  await Promise.all(
    distinctAdminIds.map(async (adminId) => {
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(adminId);
      emailByAdminId.set(adminId, error ? null : (data.user?.email ?? null));
    })
  );

  const customers: BackofficeCustomerRow[] = loopRows.map((loop) => {
    const sub = subByLoop.get(loop.id as string);
    const profile = profileById.get(loop.admin_id as string);
    return {
      loopId: loop.id as string,
      loopName: loop.name as string,
      mode: loop.mode as LoopMode,
      createdAt: loop.created_at as string,
      adminId: loop.admin_id as string,
      adminName: profile?.name ?? null,
      adminEmail: emailByAdminId.get(loop.admin_id as string) ?? null,
      memberCountActive: activeCountByLoop.get(loop.id as string) || 0,
      memberCountPending: pendingCountByLoop.get(loop.id as string) || 0,
      subscriptionStatus: (sub?.status as SubscriptionStatus | undefined) ?? null,
      trialEnd: sub?.trial_end ?? null,
      currentPeriodEnd: sub?.current_period_end ?? null,
      stripeCustomerId: sub?.stripe_customer_id ?? null,
    };
  });

  return NextResponse.json({ customers });
}
