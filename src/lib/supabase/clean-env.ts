/**
 * Nettoie une valeur d'environnement Supabase (URL ou clé).
 *
 * Les clés Supabase (JWT base64url) et les URLs sont strictement en ASCII
 * imprimable. Un copier-coller depuis un PDF ou un document mis en forme peut y
 * glisser des caractères parasites (espaces insécables, puces « • », guillemets
 * typographiques…). Un seul caractère hors ASCII fait échouer les requêtes HTTP
 * avec « Cannot convert argument to a ByteString ».
 *
 * On retire donc tout caractère hors ASCII imprimable et on supprime les
 * espaces de bord. Sur une valeur déjà propre, l'opération est sans effet.
 */
export function cleanSupabaseEnv(value: string | undefined | null): string {
  return (value || "").replace(/[^\x20-\x7E]/g, "").trim();
}
