/** Liste blanche des emails administrateurs, définie via ADMIN_EMAILS (côté hébergeur). */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(/[,\s;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null): boolean {
  const e = (email || "").trim().toLowerCase();
  if (!e) return false;
  return adminEmails().includes(e);
}
