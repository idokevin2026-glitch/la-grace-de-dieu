import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/** Renvoie {user, profile} si la requête est authentifiée avec role=admin, sinon null. */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!profile || (profile as Profile).role !== "admin") return null;
  return { supabase, user, profile: profile as Profile };
}

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, user };
}
