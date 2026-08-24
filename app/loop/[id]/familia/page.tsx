"use client";

import { useState } from "react";
import { Route as RouteIcon, UserPlus, Pencil, X, Check } from "lucide-react";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { useLoop, roleLabel } from "../LoopContext";
import { MEMBER_COLOR_OPTIONS, getMemberGradient } from "@/lib/memberColors";
import type { MemberRole } from "@/lib/types";

export default function FamiliaPage() {
  const {
    loop,
    isAdmin,
    members,
    myAge,
    saveAge,
    routeUserId,
    toggleRoute,
    addPendingMember,
    updatePendingMemberPhone,
    cancelPendingMember,
  } = useLoop();
  const [ageInput, setAgeInput] = useState("");

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newColor, setNewColor] = useState(MEMBER_COLOR_OPTIONS[0].slug);
  const [newRole, setNewRole] = useState<"supervisor" | "tracked">("tracked");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [editingPhoneId, setEditingPhoneId] = useState<string | null>(null);
  const [editPhoneValue, setEditPhoneValue] = useState("");

  async function handleSaveAge(e: React.FormEvent) {
    e.preventDefault();
    if (!ageInput) return;
    await saveAge(Number(ageInput));
    setAgeInput("");
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!newName || !newPhone) return;
    setAdding(true);
    setAddError(null);
    const role: MemberRole = loop.mode === "mirror" ? "member" : newRole;
    const { error } = await addPendingMember(newName, newPhone, newColor, role);
    if (error) {
      setAddError(error);
    } else {
      setNewName("");
      setNewPhone("");
      setNewColor(MEMBER_COLOR_OPTIONS[0].slug);
      setShowAddForm(false);
    }
    setAdding(false);
  }

  function startEditPhone(memberId: string, currentPhone: string | null) {
    setEditingPhoneId(memberId);
    setEditPhoneValue(currentPhone || "");
  }

  async function handleSaveEditedPhone(memberId: string) {
    if (!editPhoneValue) return;
    await updatePendingMemberPhone(memberId, editPhoneValue);
    setEditingPhoneId(null);
  }

  return (
    <div className="flex-1 p-4 space-y-4">
      <div className="bg-white rounded-xl border border-loopy-100 shadow-card md:shadow-card-hover p-4 md:p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold text-loopy-900">Miembros</h2>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowAddForm((v) => !v)}
              className="flex items-center gap-1 text-xs font-semibold text-bridge hover:text-loopy-900"
            >
              <UserPlus size={14} />
              Agregar miembro
            </button>
          )}
        </div>
        <ul className="text-sm space-y-2">
          {members.map((m) => {
            const isPending = !m.user_id;
            const displayName = isPending ? m.pending_name || "Invitado" : m.profiles?.name || "Miembro";
            return (
              <li key={m.id} className="flex items-center gap-2 text-loopy-700">
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                  style={{ background: getMemberGradient(m.member_color) }}
                >
                  {displayName.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="truncate">{displayName}</span>
                    {isPending && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-bridge bg-bridge/10 rounded-full px-1.5 py-0.5 shrink-0">
                        Invitado
                      </span>
                    )}
                  </span>
                  {!isPending && m.profiles?.age ? (
                    <span className="block text-xs text-loopy-700/60">{m.profiles.age} años</span>
                  ) : null}
                  {isPending && editingPhoneId !== m.id && (
                    <span className="block text-xs text-loopy-700/60">{m.pending_phone}</span>
                  )}
                  {isPending && editingPhoneId === m.id && (
                    <span className="mt-1 flex items-center gap-1.5">
                      <PhoneInput
                        international
                        value={editPhoneValue}
                        onChange={(v) => setEditPhoneValue(v || "")}
                        className="loopy-phone-input text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveEditedPhone(m.id)}
                        aria-label="Guardar teléfono"
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white bg-bridge shrink-0"
                      >
                        <Check size={12} />
                      </button>
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  {!isPending && <span className="text-xs text-bridge font-medium">{roleLabel(m.role)}</span>}
                  {isPending && isAdmin && editingPhoneId !== m.id && (
                    <button
                      type="button"
                      onClick={() => startEditPhone(m.id, m.pending_phone)}
                      aria-label={`Editar teléfono de ${displayName}`}
                      title="Editar teléfono"
                      className="w-6 h-6 rounded-full flex items-center justify-center text-loopy-700/50 hover:bg-loopy-50 hover:text-bridge"
                    >
                      <Pencil size={12} />
                    </button>
                  )}
                  {isPending && isAdmin && (
                    <button
                      type="button"
                      onClick={() => cancelPendingMember(m.id)}
                      aria-label={`Cancelar invitación de ${displayName}`}
                      title="Cancelar invitación"
                      className="w-6 h-6 rounded-full flex items-center justify-center text-loopy-700/50 hover:bg-red-50 hover:text-red-600"
                    >
                      <X size={13} />
                    </button>
                  )}
                  {!isPending && (
                    <button
                      type="button"
                      onClick={() => toggleRoute(m.user_id as string)}
                      aria-label={`Ver recorrido de ${displayName}`}
                      title="Ver recorrido de hoy en el mapa"
                      className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                        routeUserId === m.user_id
                          ? "bg-glow-500 text-white"
                          : "text-loopy-700/50 hover:bg-loopy-50 hover:text-bridge"
                      }`}
                    >
                      <RouteIcon size={13} />
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        {!myAge && (
          <form onSubmit={handleSaveAge} className="mt-3 flex gap-2">
            <input
              type="number"
              min={0}
              max={120}
              placeholder="Tu edad (opcional)"
              className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-loopy-50 text-xs focus:outline-none focus:ring-2 focus:ring-bridge/60"
              value={ageInput}
              onChange={(e) => setAgeInput(e.target.value)}
            />
            <button type="submit" className="px-3 py-1.5 rounded-lg bg-bridge/10 text-bridge text-xs font-semibold shrink-0">
              Guardar
            </button>
          </form>
        )}
      </div>

      {isAdmin && showAddForm && (
        <form
          onSubmit={handleAddMember}
          className="bg-white rounded-xl border border-loopy-100 shadow-card md:shadow-card-hover p-4 md:p-6"
        >
          <h2 className="font-bold text-loopy-900 mb-2 flex items-center gap-1.5">
            <UserPlus size={16} className="text-bridge" />
            Agregar miembro
          </h2>
          <input
            placeholder="Nombre"
            className="w-full mb-3 px-3 py-2 rounded-lg border border-loopy-50 text-sm focus:outline-none focus:ring-2 focus:ring-bridge/60"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
          />
          <PhoneInput
            value={newPhone}
            onChange={(value) => setNewPhone(value || "")}
            placeholder="+34 600 000 000"
            international
            required
            className="loopy-phone-input w-full mb-3"
          />
          <p className="text-xs text-loopy-700/60 mb-2">Color</p>
          <div className="flex gap-2 mb-3">
            {MEMBER_COLOR_OPTIONS.map((opt) => (
              <button
                key={opt.slug}
                type="button"
                onClick={() => setNewColor(opt.slug)}
                aria-label={`Elegir color ${opt.slug}`}
                className={`w-8 h-8 rounded-full shrink-0 transition-transform ${
                  newColor === opt.slug ? "ring-2 ring-loopy-900 ring-offset-2 scale-110" : ""
                }`}
                style={{ background: `linear-gradient(135deg, ${opt.from}, ${opt.to})` }}
              />
            ))}
          </div>
          {loop.mode === "supervision" && (
            <>
              <select
                className="w-full mb-1 px-3 py-2 rounded-lg border border-loopy-50 text-sm"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as "supervisor" | "tracked")}
              >
                <option value="tracked">Comparte su ubicación</option>
                <option value="supervisor">Supervisor</option>
              </select>
              <p className="text-xs text-loopy-700/60 mb-3">Rol dentro del Loopy (Modo Supervisión).</p>
            </>
          )}
          {addError && <p className="text-red-600 text-xs mb-3">{addError}</p>}
          <button
            type="submit"
            disabled={adding}
            className="w-full py-2 rounded-full bg-gradient-to-r from-loopy-700 via-bridge to-glow-500 text-white text-sm font-semibold shadow-cta hover:shadow-cta-hover disabled:opacity-60"
          >
            {adding ? "Agregando..." : "Agregar"}
          </button>
        </form>
      )}
    </div>
  );
}
