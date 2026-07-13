import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const { email } = await request.json();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email).trim())) {
    return NextResponse.json({ error: "Email invalide" }, { status: 400 });
  }
  const supabase = await createClient();
  // ignoreDuplicates : évite le chemin UPDATE d'un upsert classique, pour lequel il n'existe pas de policy RLS
  // (l'inscription est en écriture seule pour un visiteur anonyme).
  const { error } = await supabase.from("newsletter_subscribers").upsert({ email: email.trim().toLowerCase() }, { onConflict: "email", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
