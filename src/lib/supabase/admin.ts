import { createClient as createRawClient } from "@supabase/supabase-js";

/**
 * Client Supabase "service role" — contourne la RLS.
 * SERVEUR UNIQUEMENT (route handlers de confiance) : jamais importé dans un composant client,
 * jamais renvoyé au navigateur. Utilisé pour : création de commande (recalcul serveur des
 * montants), suivi public de commande, webhook de paiement.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase service role non configuré (SUPABASE_SERVICE_ROLE_KEY manquant).");
  }
  return createRawClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
