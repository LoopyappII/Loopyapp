"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, Users, CheckCircle2, Clock, AlertTriangle, Euro, ChevronRight, type LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getMemberGradient, MEMBER_COLOR_OPTIONS } from "@/lib/memberColors";
import { cn } from "@/lib/utils";
import type { BackofficeCustomerRow } from "@/app/api/admin/customers/route";
import type { SubscriptionStatus } from "@/lib/types";

// Precio público actual (ver app/signup/page.tsx y
// components/MagnifierLanding.tsx: "19,99€/mes, hasta 4 miembros").
// Hardcodeado a propósito para una estimación rápida — si el precio
// cambia, actualizar esta constante a mano.
const MONTHLY_PRICE_EUR = 19.99;

const ROW_GRID =
  "grid grid-cols-[6px_40px_minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_112px_minmax(0,0.9fr)_20px] items-center gap-x-3";

// Mismo agrupamiento de color que STATUS_COLOR en StatusBadge, pero como
// barra de acento a la izquierda de cada fila — para escanear el estado
// de un vistazo sin leer el texto de la pill.
function statusAccentClass(status: SubscriptionStatus | null): string {
  switch (status) {
    case "active":
    case "trialing":
      return "bg-green-400";
    case "trialing_no_card":
    case "incomplete":
    case "past_due":
      return "bg-amber-400";
    case "unpaid":
      return "bg-red-400";
    case "admin_bypass":
      return "bg-bridge";
    default:
      return "bg-loopy-100";
  }
}

// Variedad de color determinística por admin (sin depender de un campo
// nuevo en la base) — mismo set de tonos de marca que ya usan los
// avatares de loop_members, solo que acá el "slug" se deriva de un hash
// simple del adminId en vez de venir guardado.
function colorSlugForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return MEMBER_COLOR_OPTIONS[hash % MEMBER_COLOR_OPTIONS.length].slug;
}

export default function AdminPage() {
  const [customers, setCustomers] = useState<BackofficeCustomerRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        setError("Tu sesión expiró. Volvé a acceder.");
        return;
      }
      const res = await fetch("/api/admin/customers", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "No se pudo cargar la lista de clientes");
        return;
      }
      setCustomers(json.customers as BackofficeCustomerRow[]);
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!customers) return [];
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.loopName.toLowerCase().includes(q) ||
        (c.adminName || "").toLowerCase().includes(q) ||
        (c.adminEmail || "").toLowerCase().includes(q)
    );
  }, [customers, query]);

  const stats = useMemo(() => {
    const list = customers || [];
    const active = list.filter((c) => c.subscriptionStatus === "active").length;
    const trialing = list.filter(
      (c) => c.subscriptionStatus === "trialing" || c.subscriptionStatus === "trialing_no_card"
    ).length;
    const atRisk = list.filter(
      (c) => c.subscriptionStatus === "past_due" || c.subscriptionStatus === "canceled"
    ).length;
    return { total: list.length, active, trialing, atRisk, mrr: active * MONTHLY_PRICE_EUR };
  }, [customers]);

  if (error) return <p className="text-red-600 text-sm">{error}</p>;
  if (!customers) return <p className="text-loopy-700">Cargando clientes...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-loopy-900">Panel de administración</h1>
        <p className="text-sm text-loopy-700/70 mt-0.5">
          Todos los Loopys de Looper Cashline, en un solo lugar.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatTile icon={Users} tone="neutral" label="Clientes" value={stats.total} />
        <StatTile icon={CheckCircle2} tone="green" label="Activos" value={stats.active} />
        <StatTile icon={Clock} tone="amber" label="En prueba" value={stats.trialing} />
        <StatTile icon={AlertTriangle} tone="red" label="Atrasados/cancelados" value={stats.atRisk} />
        <StatTile icon={Euro} tone="brand" label="MRR estimado" value={`${stats.mrr.toFixed(2)}€`} />
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-loopy-700/50" />
        <input
          placeholder="Buscar por Loopy, nombre o email del admin..."
          className="w-full pl-10 pr-4 py-3 rounded-full border border-loopy-100 bg-white shadow-card text-sm focus:outline-none focus:ring-2 focus:ring-bridge/60"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="hidden md:block space-y-2">
        {filtered.map((c) => (
          <Link
            key={c.loopId}
            href={`/admin/${c.loopId}`}
            className={cn(
              ROW_GRID,
              "group bg-white rounded-xl border border-loopy-100 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all overflow-hidden py-2.5 pr-3 cursor-pointer"
            )}
          >
            <span className={cn("self-stretch rounded-r-full", statusAccentClass(c.subscriptionStatus))} />
            <span
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
              style={{ background: getMemberGradient(colorSlugForId(c.adminId)) }}
            >
              {(c.adminName || c.loopName || "?").charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-loopy-900 truncate">{c.adminName || "Sin nombre"}</span>
              <span className="block text-xs text-loopy-700/60 truncate">{c.adminEmail || "—"}</span>
            </span>
            <span className="min-w-0 text-sm text-loopy-700 truncate">{c.loopName}</span>
            <span className="min-w-0 text-xs text-loopy-700/80 truncate">
              {c.memberCountActive} activos
              {c.memberCountPending > 0 ? ` · ${c.memberCountPending} pend.` : ""}
            </span>
            <StatusBadge status={c.subscriptionStatus} />
            <span className="text-xs text-loopy-700/70 text-right">{formatNextDate(c)}</span>
            <ChevronRight
              size={18}
              className="text-loopy-700/30 group-hover:text-bridge group-hover:translate-x-0.5 transition-all shrink-0"
            />
          </Link>
        ))}
      </div>

      <div className="md:hidden space-y-3">
        {filtered.map((c) => (
          <Link
            key={c.loopId}
            href={`/admin/${c.loopId}`}
            className="flex items-center gap-3 bg-white rounded-xl border border-loopy-100 shadow-card p-4 overflow-hidden"
          >
            <span
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
              style={{ background: getMemberGradient(colorSlugForId(c.adminId)) }}
            >
              {(c.adminName || c.loopName || "?").charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="font-semibold text-loopy-900 truncate">{c.adminName || "Sin nombre"}</span>
                <StatusBadge status={c.subscriptionStatus} />
              </span>
              <span className="block text-xs text-loopy-700/70 truncate">{c.adminEmail || "—"}</span>
              <span className="block text-xs text-loopy-700/70 mt-1 truncate">
                {c.loopName} · {c.memberCountActive} activos
                {c.memberCountPending > 0 ? ` · ${c.memberCountPending} pendientes` : ""}
              </span>
              <span className="block text-xs text-loopy-700/50 mt-1">{formatNextDate(c)}</span>
            </span>
            <ChevronRight size={18} className="text-loopy-700/30 shrink-0" />
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-loopy-700/70 text-center py-8">Sin resultados.</p>
      )}
    </div>
  );
}

function formatNextDate(c: BackofficeCustomerRow): string {
  const date = c.currentPeriodEnd || c.trialEnd;
  if (!date) return "—";
  return new Date(date).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

type StatTone = "neutral" | "green" | "amber" | "red" | "brand";

const STAT_TONE_CLASSES: Record<StatTone, string> = {
  neutral: "bg-loopy-50 text-loopy-700",
  green: "bg-green-50 text-green-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
  brand: "bg-gradient-to-br from-loopy-700 via-bridge to-glow-500 text-white",
};

function StatTile({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: LucideIcon;
  tone: StatTone;
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-white rounded-xl border border-loopy-100 shadow-card p-4 flex items-center gap-3">
      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", STAT_TONE_CLASSES[tone])}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-loopy-700/70 truncate">{label}</p>
        <p className="text-xl font-bold text-loopy-900">{value}</p>
      </div>
    </div>
  );
}
