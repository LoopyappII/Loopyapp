"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, MessageCircle, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getMemberGradient } from "@/lib/memberColors";
import type {
  BackofficeCustomerDetail,
  BackofficeMemberRow,
} from "@/app/api/admin/customers/[loopId]/route";

// Duplicado a propósito, no importado de app/loop/[id]/LoopContext.tsx:
// esa función vive atada al árbol de rutas de un Loopy individual, y esta
// vista es del backoffice — mismo criterio que el resto de la app ("cada
// página hand-rolls su lógica chica", sin compartir salvo que se repita
// 3+ veces).
function roleLabel(role: string) {
  switch (role) {
    case "admin":
      return "Admin";
    case "supervisor":
      return "Supervisor";
    case "tracked":
      return "Comparte";
    case "member":
      return "Miembro";
    default:
      return role;
  }
}

export default function AdminCustomerDetailPage({ params }: { params: { loopId: string } }) {
  const router = useRouter();
  const loopId = params.loopId;
  const [detail, setDetail] = useState<BackofficeCustomerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const [cancelConfirming, setCancelConfirming] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setError("Tu sesión expiró. Volvé a acceder.");
        return;
      }
      setAccessToken(token);
      const res = await fetch(`/api/admin/customers/${loopId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "No se pudo cargar este Loopy");
        return;
      }
      setDetail(json as BackofficeCustomerDetail);
    })();
  }, [loopId]);

  async function handleCancelSubscription() {
    if (!accessToken) return;
    setCanceling(true);
    setCancelError(null);
    const res = await fetch(`/api/admin/customers/${loopId}/cancel-subscription`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setCancelError(json.error || "No se pudo cancelar la suscripción");
      setCanceling(false);
      return;
    }
    setDetail((prev) =>
      prev ? { ...prev, subscription: { ...prev.subscription, status: "canceled" } } : prev
    );
    setCancelConfirming(false);
    setCanceling(false);
  }

  async function handleDeleteLoop() {
    if (!accessToken) return;
    setDeleting(true);
    setDeleteError(null);
    const res = await fetch(`/api/admin/customers/${loopId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setDeleteError(json.error || "No se pudo eliminar el Loopy");
      setDeleting(false);
      return;
    }
    router.push("/admin");
  }

  // Mismo link builder que app/loop/[id]/familia/page.tsx
  // (handleSendWhatsApp) — reconstruido client-side con el invite_code +
  // member.id que ya devolvió el GET, sin pegarle a ningún endpoint nuevo.
  function handleResendInvite(member: BackofficeMemberRow) {
    if (!detail || !member.phone) return;
    const digits = member.phone.replace(/[^0-9]/g, "");
    const inviteUrl = `https://www.directloopy.com/signup?invite=${detail.loop.invite_code}&pm=${member.id}`;
    const text = `Te invité a mi Loopy para compartir ubicación 💙 Aceptá acá: ${inviteUrl}`;
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  if (error) return <p className="text-red-600 text-sm">{error}</p>;
  if (!detail) return <p className="text-loopy-700">Cargando...</p>;

  const { loop, admin, members, subscription } = detail;
  const canDelete = deleteInput.trim() === loop.name;

  return (
    <div className="space-y-6">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-loopy-700 hover:text-loopy-900">
        <ArrowLeft size={15} /> Volver a clientes
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-loopy-900">{loop.name}</h1>
        <p className="text-xs text-loopy-700/70">
          {loop.mode === "mirror" ? "Modo Espejo" : "Modo Supervisión"} · Código: {loop.invite_code}
        </p>
      </div>

      <div className="bg-white rounded-xl border border-loopy-100 shadow-card p-4 md:p-6">
        <h2 className="font-bold text-loopy-900 mb-2">Administrador del Loopy</h2>
        <p className="text-sm text-loopy-900">{admin.name || "Sin nombre"}</p>
        <p className="text-sm text-loopy-700/80">{admin.email || "Sin email"}</p>
        {admin.phone && <p className="text-sm text-loopy-700/80">{admin.phone}</p>}
      </div>

      <div className="bg-white rounded-xl border border-loopy-100 shadow-card p-4 md:p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-loopy-900">Suscripción</h2>
          <StatusBadge status={subscription.status} />
        </div>
        <dl className="text-sm text-loopy-700/80 space-y-1 mb-4">
          {subscription.trialEnd && (
            <div className="flex justify-between">
              <dt>Fin de prueba</dt>
              <dd>{new Date(subscription.trialEnd).toLocaleDateString("es-ES")}</dd>
            </div>
          )}
          {subscription.currentPeriodEnd && (
            <div className="flex justify-between">
              <dt>Próximo cobro</dt>
              <dd>{new Date(subscription.currentPeriodEnd).toLocaleDateString("es-ES")}</dd>
            </div>
          )}
        </dl>

        <div className="flex flex-wrap items-center gap-3">
          {subscription.isRealStripeCustomer && (
            <a
              href={`https://dashboard.stripe.com/customers/${subscription.stripeCustomerId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-semibold text-bridge hover:text-loopy-900"
            >
              <ExternalLink size={13} /> Ver en Stripe
            </a>
          )}

          {subscription.status !== null &&
            subscription.status !== "canceled" &&
            (cancelConfirming ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-loopy-700">¿Seguro? Esto corta el acceso del Loopy ya mismo.</span>
                <button
                  type="button"
                  onClick={handleCancelSubscription}
                  disabled={canceling}
                  className="px-3 py-1.5 rounded-full bg-red-600 text-white text-xs font-semibold disabled:opacity-60"
                >
                  {canceling ? "Cancelando..." : "Sí, cancelar"}
                </button>
                <button
                  type="button"
                  onClick={() => setCancelConfirming(false)}
                  className="px-3 py-1.5 rounded-full border border-loopy-100 text-xs text-loopy-700"
                >
                  Volver
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCancelConfirming(true)}
                className="px-3 py-1.5 rounded-full border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50"
              >
                Cancelar suscripción
              </button>
            ))}
        </div>
        {cancelError && <p className="text-red-600 text-xs mt-2">{cancelError}</p>}
      </div>

      <div className="bg-white rounded-xl border border-loopy-100 shadow-card p-4 md:p-6">
        <h2 className="font-bold text-loopy-900 mb-2">Miembros ({members.length})</h2>
        <ul className="text-sm space-y-2">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-2 text-loopy-700">
              <span
                className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                style={{ background: getMemberGradient(m.memberColor) }}
              >
                {(m.name || "?").charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="truncate">{m.name || "Invitado"}</span>
                  {m.isPending && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-bridge bg-bridge/10 rounded-full px-1.5 py-0.5 shrink-0">
                      Invitado
                    </span>
                  )}
                </span>
                {m.phone && <span className="block text-xs text-loopy-700/60">{m.phone}</span>}
              </span>
              <span className="flex items-center gap-2 shrink-0">
                {!m.isPending && <span className="text-xs text-bridge font-medium">{roleLabel(m.role)}</span>}
                {m.isPending && m.phone && (
                  <button
                    type="button"
                    onClick={() => handleResendInvite(m)}
                    aria-label={`Reenviar invitación a ${m.name || "este miembro"}`}
                    title="Reenviar invitación por WhatsApp"
                    className="w-6 h-6 rounded-full flex items-center justify-center text-loopy-700/50 hover:bg-green-50 hover:text-green-600"
                  >
                    <MessageCircle size={12} />
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-white rounded-xl border border-red-100 shadow-card p-4 md:p-6">
        <h2 className="font-bold text-red-600 mb-1">Zona de peligro</h2>
        <p className="text-sm text-loopy-700/80 mb-3">
          Eliminar este Loopy borra sus miembros, zonas, ubicaciones y su historial. No se puede deshacer.
        </p>
        <label className="block text-xs text-loopy-700/70 mb-1">
          Escribí <span className="font-semibold">{loop.name}</span> para confirmar
        </label>
        <input
          className="w-full mb-3 px-3 py-2 rounded-lg border border-loopy-50 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
          value={deleteInput}
          onChange={(e) => setDeleteInput(e.target.value)}
        />
        {deleteError && <p className="text-red-600 text-xs mb-2">{deleteError}</p>}
        <button
          type="button"
          onClick={handleDeleteLoop}
          disabled={!canDelete || deleting}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-600 text-white text-sm font-semibold disabled:opacity-40"
        >
          <Trash2 size={15} />
          {deleting ? "Eliminando..." : "Eliminar este Loopy"}
        </button>
      </div>
    </div>
  );
}
