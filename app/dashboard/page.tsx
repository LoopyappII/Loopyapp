"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { LogOut, Plus, KeyRound } from "lucide-react";
import { NavbarLogo } from "@/components/LoopyLogo";
import { SkeletonCard } from "@/components/Skeleton";
import { supabase } from "@/lib/supabaseClient";
import type { Loop, LoopMode } from "@/lib/types";
import { fadeInUp, staggerContainer } from "@/lib/motion";

export default function DashboardPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loops, setLoops] = useState<Loop[]>([]);
  const [loading, setLoading] = useState(true);

  const [newLoopName, setNewLoopName] = useState("");
  const [newLoopMode, setNewLoopMode] = useState<LoopMode>("mirror");
  const [creating, setCreating] = useState(false);

  const [joinCode, setJoinCode] = useState("");
  const [joinRole, setJoinRole] = useState<"supervisor" | "tracked">("tracked");
  const [joining, setJoining] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push("/login");
        return;
      }
      setUserId(userData.user.id);
      await loadLoops(userData.user.id);
      setLoading(false);
    })();
  }, [router]);

  async function loadLoops(uid: string) {
    const { data: memberships } = await supabase
      .from("loop_members")
      .select("loop_id")
      .eq("user_id", uid);

    const loopIds = (memberships || []).map((m) => m.loop_id);
    if (loopIds.length === 0) {
      setLoops([]);
      return;
    }
    const { data: loopsData } = await supabase
      .from("loops")
      .select("*")
      .in("id", loopIds)
      .order("created_at", { ascending: false });
    setLoops(loopsData || []);
  }

  async function handleCreateLoop(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setCreating(true);
    setFormError(null);
    const { data: loop, error } = await supabase
      .from("loops")
      .insert({ name: newLoopName, mode: newLoopMode, admin_id: userId })
      .select()
      .single();

    if (error || !loop) {
      setFormError(error?.message || "No se pudo crear el Loopy");
      setCreating(false);
      return;
    }

    await supabase.from("loop_members").insert({
      loop_id: loop.id,
      user_id: userId,
      role: "admin",
    });

    setNewLoopName("");
    await loadLoops(userId);
    setCreating(false);
  }

  async function handleJoinLoop(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setJoining(true);
    setFormError(null);

    const { data: loop, error: loopError } = await supabase
      .from("loops")
      .select("*")
      .eq("invite_code", joinCode.trim())
      .single();

    if (loopError || !loop) {
      setFormError("Código de invitación inválido");
      setJoining(false);
      return;
    }

    const role = loop.mode === "mirror" ? "member" : joinRole;

    const { error: joinErr } = await supabase.from("loop_members").insert({
      loop_id: loop.id,
      user_id: userId,
      role,
    });

    if (joinErr) {
      setFormError(joinErr.message);
      setJoining(false);
      return;
    }

    setJoinCode("");
    await loadLoops(userId);
    setJoining(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (loading) {
    return (
      <main className="relative min-h-screen px-6 py-8 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <NavbarLogo size={32} dark />
        </div>
        <div className="h-6 w-40 skeleton animate-shimmer rounded-lg mb-4" />
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen">
      <div className="relative z-10 px-6 py-8 max-w-md mx-auto">
        <div className="flex items-center justify-between mb-8">
          <NavbarLogo size={32} dark />
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm text-loopy-700 border border-loopy-100 hover:border-bridge/50 hover:text-loopy-900 transition-colors"
          >
            <LogOut size={15} />
            Cerrar sesión
          </button>
        </div>

        <h1 className="text-2xl font-bold text-loopy-900 mb-4">Tus Loopys</h1>

        {loops.length === 0 ? (
          <p className="text-loopy-700 mb-8">
            Todavía no formas parte de ningún Loopy. Crea uno o únete con un
            código de invitación.
          </p>
        ) : (
          <motion.ul
            variants={staggerContainer(0.08)}
            initial="hidden"
            animate="show"
            className="space-y-3 mb-10"
          >
            {loops.map((loop) => (
              <motion.li key={loop.id} variants={fadeInUp}>
                <Link
                  href={`/loop/${loop.id}/mapa`}
                  className="block bg-white rounded-xl border border-loopy-100 shadow-card p-4 hover:border-bridge/40 hover:shadow-card-hover transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-loopy-900">
                      {loop.name}
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full bg-bridge/10 text-bridge font-medium">
                      {loop.mode === "mirror" ? "Espejo" : "Supervisión"}
                    </span>
                  </div>
                  <span className="text-xs text-loopy-700/70">
                    Código: {loop.invite_code}
                  </span>
                </Link>
              </motion.li>
            ))}
          </motion.ul>
        )}

        {formError && (
          <p className="text-red-600 text-sm mb-4">{formError}</p>
        )}

        <div className="grid gap-6">
          <form
            onSubmit={handleCreateLoop}
            className="bg-white rounded-2xl border border-loopy-100 shadow-card p-6"
          >
            <h2 className="font-bold text-loopy-900 mb-4 flex items-center gap-2">
              <Plus size={18} className="text-bridge" />
              Crear un Loopy
            </h2>
            <input
              placeholder="Nombre del Loopy"
              className="w-full mb-3 px-3 py-2 rounded-lg border border-loopy-50 focus:outline-none focus:ring-2 focus:ring-bridge/60"
              value={newLoopName}
              onChange={(e) => setNewLoopName(e.target.value)}
              required
            />
            <select
              className="w-full mb-4 px-3 py-2 rounded-lg border border-loopy-50"
              value={newLoopMode}
              onChange={(e) => setNewLoopMode(e.target.value as LoopMode)}
            >
              <option value="mirror">Modo Espejo (todos se ven)</option>
              <option value="supervision">Modo Supervisión (roles)</option>
            </select>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={creating}
              className="w-full py-2.5 rounded-full bg-gradient-to-r from-loopy-700 via-bridge to-glow-500 text-white font-semibold shadow-cta hover:shadow-cta-hover disabled:opacity-60"
            >
              {creating ? "Creando..." : "Crear Loopy"}
            </motion.button>
          </form>

          <form
            onSubmit={handleJoinLoop}
            className="bg-white rounded-2xl border border-loopy-100 shadow-card p-6"
          >
            <h2 className="font-bold text-loopy-900 mb-4 flex items-center gap-2">
              <KeyRound size={18} className="text-bridge" />
              Unirse a un Loopy
            </h2>
            <input
              placeholder="Código de invitación"
              className="w-full mb-3 px-3 py-2 rounded-lg border border-loopy-50 focus:outline-none focus:ring-2 focus:ring-bridge/60"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              required
            />
            <select
              className="w-full mb-4 px-3 py-2 rounded-lg border border-loopy-50"
              value={joinRole}
              onChange={(e) =>
                setJoinRole(e.target.value as "supervisor" | "tracked")
              }
            >
              <option value="tracked">Comparto mi ubicación</option>
              <option value="supervisor">Voy a supervisar (Supervisor)</option>
            </select>
            <p className="text-xs text-loopy-700/70 mb-3">
              El rol solo aplica si el Loopy es de modo Supervisión.
            </p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={joining}
              className="w-full py-2.5 rounded-full bg-loopy-900 text-white font-semibold shadow-[0_8px_24px_rgba(35,42,82,0.35)] hover:shadow-[0_10px_32px_rgba(35,42,82,0.5)] disabled:opacity-60"
            >
              {joining ? "Uniendo..." : "Unirme"}
            </motion.button>
          </form>
        </div>
      </div>
    </main>
  );
}
