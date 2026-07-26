export type LoopMode = "mirror" | "supervision";
export type MemberRole = "admin" | "supervisor" | "tracked" | "member";

export interface Profile {
  id: string;
  name: string | null;
  avatar_url: string | null;
  phone: string | null;
}

export interface Loop {
  id: string;
  name: string;
  mode: LoopMode;
  invite_code: string;
  admin_id: string;
  created_at: string;
}

export interface LoopMember {
  id: string;
  loop_id: string;
  user_id: string;
  role: MemberRole;
  profiles?: Profile;
}

export interface LocationRow {
  id: string;
  user_id: string;
  loop_id: string;
  lat: number;
  lng: number;
  recorded_at: string;
}

export interface SafeZone {
  id: string;
  loop_id: string;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
}
