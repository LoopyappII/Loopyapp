// Lista de emails admitidos para crear/usar Loopys sin pasar por el pago
// real de Stripe — solo para pruebas internas o cuentas de administración.
// Configurar en Vercel/`.env.local` como ADMIN_BYPASS_EMAILS, una lista
// separada por comas (ej. "sebastian@directloopy.com,qa@directloopy.com").
// Comparación case-insensitive, ignorando espacios. Sin la variable
// configurada, nadie tiene bypass (comportamiento actual sin cambios).
export function isAdminBypassEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowlist = (process.env.ADMIN_BYPASS_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.trim().toLowerCase());
}
