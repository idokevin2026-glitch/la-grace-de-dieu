import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin-allow";

/**
 * Promotion self-service en administrateur.
 *
 * Sécurité : la route exige une session valide (l'utilisateur connaît déjà son
 * mot de passe et a confirmé son email). On ne promeut que l'utilisateur
 * *courant*, et seulement si son email figure dans la liste d'autorisation
 * `ADMIN_EMAILS` (définie côté hébergeur, ex. Vercel). Il n'y a donc aucun moyen
 * de promouvoir le compte de quelqu'un d'autre ni de réinitialiser un mot de passe.
 */
export async function POST() {
  const auth = await requireUser();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!isAdminEmail(auth.user.email)) return NextResponse.json({ promoted: false, reason: "not_allowed" });

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
