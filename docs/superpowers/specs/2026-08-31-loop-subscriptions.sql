-- Loopy — suscripción con Stripe: migración manual
-- Correr en Supabase Dashboard → SQL Editor del proyecto de Loopy
-- (xumacwfsabojqefhaozm). Esta sesión no tiene acceso de escritura a esa
-- base — Sebastián lo corre a mano. Ver el spec completo en
-- 2026-08-31-loopy-stripe-billing-design.md para el contexto.

create table public.loop_subscriptions (
  loop_id uuid primary key references public.loops(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  status text not null default 'incomplete',
  trial_end timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index loop_subscriptions_status_idx on public.loop_subscriptions(status);

alter table public.loop_subscriptions enable row level security;

-- Cualquier miembro del Loopy puede LEER el estado de la suscripción
-- (para mostrar el aviso de "reactivar" incluso a no-admins).
create policy "loop_subscriptions_select_members"
  on public.loop_subscriptions for select
  using (
    exists (
      select 1 from public.loop_members
      where loop_members.loop_id = loop_subscriptions.loop_id
        and loop_members.user_id = auth.uid()
    )
  );

-- A propósito, sin policy de INSERT/UPDATE/DELETE para usuarios: solo el
-- webhook escribe, autenticado con la service_role key (bypassea RLS por
-- diseño de Supabase). Ningún cliente debe poder escribir su propio
-- estado de suscripción.
