import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Diagnostic (temporaire) : localise un éventuel caractère non-ASCII dans les
 * variables d'environnement Supabase/admin, sans jamais révéler leur valeur.
 * Protégé par le code d'installation (ADMIN_SETUP_SECRET).
 */
function scan(value: string | undefined | null) {
  const raw = value || "";
  const cleaned = raw.replace(/[^\x20-\x7E]/g, "").trim();
  const bad: { index: number; code: number }[] = [];
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i);
    if (code < 0x20 || code > 0x7e) bad.push({ index: i, code });
  }
  return { present: raw.length > 0, rawLength: raw.length, cleanedLength: cleaned.length, nonAscii: bad };
}

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret") || "";
  const configured = process.env.ADMIN_SETUP_SECRET || "";
  if (!configured || secret !== configured) {
    return NextResponse.json({ error: "Code d'installation requis (?secret=...)." }, { status: 403 });
  }

  const vars = {
    NEXT_PUBLIC_SUPABASE_URL: scan(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: scan(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    SUPABASE_SERVICE_ROLE_KEY: scan(process.env.SUPABASE_SERVICE_ROLE_KEY),
    ADMIN_EMAILS: scan(process.env.ADMIN_EMAILS),
    ADMIN_SETUP_SECRET: scan(process.env.ADMIN_SETUP_SECRET),
  };

  // Test réel d'un appel admin (avec clé nettoyée) pour confirmer que ça passe.
  let adminPing: { ok: boolean; error?: string } = { ok: false };
  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
    adminPing = error ? { ok: false, error: error.message } : { ok: true };
  } catch (e) {
    adminPing = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  return NextResponse.json({ marker: "envcheck-v1", vars, adminPing });
}
