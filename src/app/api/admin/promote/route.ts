import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Promotion self-service en administrateur.
 *
 * Sécurité : la route exige une session valide (l'utilisateur connaît déjà son
 * mot de passe et a confirmé son email). On ne promeut que l'utilisateur
 * *courant*, et seulement si son email figure dans la liste d'autorisation
 * `ADMIN_EMAILS` (définie côté hébergeur, ex. Vercel). Il n'y a donc aucun moyen
 * de promouvoir le compte de quelqu'un d'autre ni de réinitialiser un mot de passe.
 */
function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(/[,\s;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function POST() {
  const auth = await requireUser();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const email = (auth.user.email || "").trim().toLowerCase();
  const allow = adminEmails();

  // Rien de configuré : on ne fait rien (mais pas d'erreur bloquante).
  if (allow.length === 0) return NextResponse.json({ promoted: false, reason: "not_configured" });
  if (!email || !allow.includes(email)) return NextResponse.json({ promoted: false, reason: "not_allowed" });

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Clé service_role Supabase manquante (SUPABASE_SERVICE_ROLE_KEY)." }, { status: 500 });
  }

  const { error } = await admin
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", auth.user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ promoted: true, role: "admin" });
}
