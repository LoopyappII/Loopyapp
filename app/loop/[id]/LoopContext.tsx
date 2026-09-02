"use client";

import { createContext, useContext } from "react";
import type { Loop, LoopMember, MemberRole, SafeZone, SpeedAlert, SubscriptionStatus } from "@/lib/types";
import type { MapMember } from "@/components/LiveMap";

export interface ZoneEventRow {
  id: string;
  event_type: "enter" | "exit";
  created_at: string;
  user_id: string;
  safe_zones: { name: string } | null;
}

export function roleLabel(role: string) {
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

export interface LoopContextValue {
  loopId: string;
  userId: string;
  loop: Loop;
  members: LoopMember[];
  isAdmin: boolean;
  subscriptionStatus: SubscriptionStatus | null;
  zones: SafeZone[];
  mapMembers: Record<string, MapMember>;
  events: ZoneEventRow[];
  speedAlerts: SpeedAlert[];
  myPos: { lat: number; lng: number } | null;
  myAge: number | null;
  routeUserId: string | null;
  routePoints: { lat: number; lng: number }[];
  routeLoading: boolean;
  toggleRoute: (uid: string) => void;
  addZone: (name: string, radiusM: number, coords?: { lat: number; lng: number }) => Promise<{ error: string | null }>;
  saveAge: (age: number) => Promise<void>;
  saveLoopSettings: (
    speedLimitKmh: number | null,
    emergencyNumber: string | null,
    primaryContactNumber: string | null
  ) => Promise<{ error: string | null }>;
  addPendingMember: (
    name: string,
    phone: string,
    colorSlug: string,
    role: MemberRole
  ) => Promise<{ error: string | null }>;
  updatePendingMemberPhone: (memberId: string, phone: string) => Promise<{ error: string | null }>;
  cancelPendingMember: (memberId: string) => Promise<{ error: string | null }>;
}

export const LoopContext = createContext<LoopContextValue | null>(null);

export function useLoop(): LoopContextValue {
  const ctx = useContext(LoopContext);
  if (!ctx) {
    throw new Error("useLoop debe usarse dentro de app/loop/[id]/layout.tsx");
  }
  return ctx;
}
