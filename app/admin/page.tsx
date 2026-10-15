"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { StatusBadge } from "@/components/admin/StatusBadge";
import type { BackofficeCustomerRow } from "@/app/api/admin/customers/route";

// Precio público actual (ver app/signup/page.tsx y
// components/MagnifierLanding.tsx: "19,99€/mes, hasta 4 miembros").
// Hardcodeado a propósito para una estimación rápida — si el precio
// cambia, actualizar esta constante a mano.
const MONTHLY_PRICE_EUR = 19.99;

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
      <h1 className="text-2xl font-bold text-loopy-900">Panel de administración</h1>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatTile label="Clientes" value={stats.total} />
        <StatTile label="Activos" value={stats.active} />
        <StatTile label="En prueba" value={stats.trialing} />
        <StatTile label="Atrasados/cancelados" value={stats.atRisk} />
        <StatTile label="MRR estimado" value={`${stats.mrr.toFixed(2)}€`} />
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-loopy-700/50" />
        <input
          placeholder="Buscar por Loopy, nombre o email del admin..."
          className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-loopy-50 text-sm focus:outline-none focus:ring-2 focus:ring-bridge/60"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="hidden md:block bg-white rounded-xl border border-loopy-100 shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-loopy-50/60 text-left text-xs uppercase tracking-wide text-loopy-700/70">
            <tr>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Loopy</th>
              <th className="px-4 py-3">Miembros</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Próximo cobro / vencimiento</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-loopy-50">
            {filtered.map((c) => (
              <tr key={c.loopId} className="hover:bg-loopy-50/40">
                <td className="px-4 py-3 text-loopy-900 font-medium">{c.adminName || "Sin nombre"}</td>
                <td className="px-4 py-3 text-loopy-700/80">{c.adminEmail || "—"}</td>
                <td className="px-4 py-3 text-loopy-700">{c.loopName}</td>
                <td className="px-4 py-3 text-loopy-700/80">
                  {c.memberCountActive} activos
                  {c.memberCountPending > 0 ? ` · ${c.memberCountPending} pendientes` : ""}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={c.subscriptionStatus} />
                </td>
                <td className="px-4 py-3 text-loopy-700/80">{formatNextDate(c)}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/${c.loopId}`} className="text-bridge text-xs font-semibold hover:text-loopy-900">
                    Ver →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {filtered.map((c) => (
          <Link
            key={c.loopId}
            href={`/admin/${c.loopId}`}
            className="block bg-white rounded-xl border border-loopy-100 shadow-card p-4"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-loopy-900">{c.adminName || "Sin nombre"}</span>
              <StatusBadge status={c.subscriptionStatus} />
            </div>
            <p className="text-xs text-loopy-700/70">{c.adminEmail || "—"}</p>
            <p className="text-xs text-loopy-700/70 mt-1">
              {c.loopName} · {c.memberCountActive} activos
              {c.memberCountPending > 0 ? ` · ${c.memberCountPending} pendientes` : ""}
            </p>
            <p className="text-xs text-loopy-700/50 mt-1">{formatNextDate(c)}</p>
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

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl border border-loopy-100 shadow-card p-4">
      <p className="text-xs text-loopy-700/70">{label}</p>
      <p className="text-xl font-bold text-loopy-900">{value}</p>
    </div>
  );
}
