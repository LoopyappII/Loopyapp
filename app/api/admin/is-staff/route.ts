import { NextRequest, NextResponse } from "next/server";
import { requireAuthedUser } from "@/lib/stripeAuth";
import { isBackofficeStaffEmail } from "@/lib/backofficeAuth";

// A propósito usa requireAuthedUser (no requireStaff): la consulta
// CUALQUIER cuenta logueada (el dashboard, para decidir si mostrar el link;
// app/admin/layout.tsx, para decidir si renderizar o "No autorizado") —
// tiene que devolver 200 con isStaff:false para quien no es staff, nunca
// 403. El único requisito es estar logueado.
export async function GET(req: NextRequest) {
  const auth = await requireAuthedUser(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  return NextResponse.json({ isStaff: isBackofficeStaffEmail(auth.userEmail) });
}
