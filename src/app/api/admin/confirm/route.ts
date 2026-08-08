import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin-allow";

/**
 * Débloque un compte administrateur autorisé sans dépendre de l'email de
 * confirmation Supabase (souvent non délivré) :
 *  - confirme l'email du compte (email_confirm) s'il ne l'est pas encore ;
 *  - passe son profil en role = 'admin'.
 *
 * Sécurité : n'agit QUE sur un email présent dans la liste `ADMIN_EMAILS`
 * (contrôlée par l'hébergeur). Ne touche JAMAIS au mot de passe : confirmer un
 * email ne donne aucun accès sans connaître le mot de passe. Aucune prise de
 * contrôle de compte n'est donc possible via cette route.
 */
export async function POST(request: NextRequest) {
  const { email } = await request.json().catch(() => ({ email: "" }));
  const target = (email || "").trim().toLowerCase();

  if (!isAdminEmail(target)) {
    return NextResponse.json({ ok: false, reason: "not_allowed" }, { status: 403 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Clé service_role Supabase manquante (SUPABASE_SERVICE_ROLE_KEY)." }, { status: 500 });
  }

  // Retrouve l'utilisateur par email (site de petite taille : première page suffit).
  let userId: string | null = null;
  let alreadyConfirmed = false;
  for (let page = 1; page <= 5 && !userId; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const match = data.users.find((u) => (u.email || "").toLowerCase() === target);
    if (match) {
      userId = match.id;
      alreadyConfirmed = !!match.email_confirmed_at;
    }
    if (data.users.length < 200) break;
  }

  if (!userId) {
    // Le compte n'existe pas encore : il faut d'abord le créer (onglet « Créer un compte »).
    return NextResponse.json({ ok: false, reason: "no_user" });
  }

  if (!alreadyConfirmed) {
    const { error } = await admin.auth.admin.updateUserById(userId, { email_confirm: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { error: pErr } = await admin.from("profiles").update({ role: "admin" }).eq("id", userId);
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, confirmed: true, promoted: true });
}
