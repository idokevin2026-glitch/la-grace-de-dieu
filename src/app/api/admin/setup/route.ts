import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin-allow";

/**
 * Configuration / réinitialisation d'un compte administrateur, utile quand
 * l'email de confirmation Supabase n'est pas délivré et/ou que le mot de passe
 * est oublié.
 *
 * Double verrou de sécurité :
 *  1. l'email doit figurer dans `ADMIN_EMAILS` ;
 *  2. un `secret` doit correspondre à `ADMIN_SETUP_SECRET` (défini par le
 *     propriétaire sur l'hébergeur). Sans ce secret configuré, la route est
 *     désactivée. Cela empêche toute prise de contrôle du compte admin.
 *
 * Effet : crée le compte s'il n'existe pas, (re)définit son mot de passe,
 * confirme son email et lui donne le rôle admin.
 */
export async function POST(request: NextRequest) {
  const { email, password, secret } = await request.json().catch(() => ({}));
  const target = (email || "").trim().toLowerCase();
  const pass = typeof password === "string" ? password : "";

  if (!isAdminEmail(target)) {
    return NextResponse.json({ ok: false, error: "Cet email n'est pas autorisé (ADMIN_EMAILS)." }, { status: 403 });
  }
  if (pass.length < 6) {
    return NextResponse.json({ ok: false, error: "Le mot de passe doit contenir au moins 6 caractères." }, { status: 400 });
  }

  const configured = process.env.ADMIN_SETUP_SECRET || "";
  if (!configured) {
    return NextResponse.json(
      { ok: false, error: "Configuration admin désactivée : définissez ADMIN_SETUP_SECRET sur l'hébergeur (Vercel)." },
      { status: 403 }
    );
  }
  if ((secret || "") !== configured) {
    return NextResponse.json({ ok: false, error: "Code d'installation incorrect." }, { status: 403 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Clé service_role Supabase manquante (SUPABASE_SERVICE_ROLE_KEY)." }, { status: 500 });
  }

  // Retrouve un éventuel compte existant pour cet email.
  let userId: string | null = null;
  for (let page = 1; page <= 5 && !userId; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const match = data.users.find((u) => (u.email || "").toLowerCase() === target);
    if (match) userId = match.id;
    if (data.users.length < 200) break;
  }

  if (userId) {
    const { error } = await admin.auth.admin.updateUserById(userId, { password: pass, email_confirm: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email: target, password: pass, email_confirm: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    userId = data.user?.id ?? null;
  }

  if (userId) {
    // Le profil est créé par trigger à l'inscription ; on force le rôle admin (upsert par sécurité).
    const { error } = await admin.from("profiles").upsert({ id: userId, role: "admin", email: target }, { onConflict: "id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
