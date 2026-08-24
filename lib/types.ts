export type LoopMode = "mirror" | "supervision";
export type MemberRole = "admin" | "supervisor" | "tracked" | "member";

export interface Profile {
  id: string;
  name: string | null;
  avatar_url: string | null;
  phone: string | null;
  age: number | null;
}

export interface Loop {
  id: string;
  name: string;
  mode: LoopMode;
  invite_code: string;
  admin_id: string;
  created_at: string;
  speed_limit_kmh: number | null;
  emergency_number: string | null;
  primary_contact_number: string | null;
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

export interface SpeedAlert {
  id: string;
  loop_id: string;
  user_id: string;
  speed_kmh: number;
  limit_kmh: number;
  lat: number;
  lng: number;
  created_at: string;
}

export interface SosAlert {
  id: string;
  loop_id: string;
  user_id: string;
  lat: number;
  lng: number;
  created_at: string;
}
