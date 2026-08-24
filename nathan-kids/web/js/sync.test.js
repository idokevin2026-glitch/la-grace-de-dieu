// Harness Node : valide la FUSION du delta de sync_since (anti « stock qui disparaît »).
const store = new Map();
global.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
Object.defineProperty(globalThis, "navigator", { configurable: true, get: () => ({ onLine: true }) });
global.crypto = require("crypto").webcrypto;
global.window = { NK_CONFIG: { SUPABASE_URL: "http://x", SUPABASE_ANON_KEY: "anon", FUNCTIONS_URL: "http://x/fn" }, addEventListener: () => {} };

let syncPayload;
global.fetch = async (url, opt) => {
  // Toutes les lectures passent par rest() → on ne répond qu'au RPC sync_since.
  const body = JSON.stringify(syncPayload);
  return { ok: true, status: 200, text: async () => body, json: async () => syncPayload };
};

store.set("nk.tokens", JSON.stringify({ accessToken: "a", refreshToken: "r" }));
store.set("nk.user", JSON.stringify({ id: "u1", name: "Silué", role: "admin" }));
const NK = require("/home/user/la-grace-de-dieu/nathan-kids/web/js/api.js");

let pass = 0, fail = 0;
const assert = (c, m) => (c ? (pass++, console.log("  ✓", m)) : (fail++, console.log("  ✗ ÉCHEC:", m)));
const ids = (arr) => arr.map((p) => p.id).sort().join(",");

(async () => {
  console.log("[1] 1re synchro (complète) : tous les produits arrivent");
  syncPayload = { now: "2026-08-01T10:00:00Z", products: [
    { id: "a", name_fr: "Chaussures", archived: false },
    { id: "b", name_fr: "Sac cartable", archived: false },
  ] };
  let d = await NK.reads.sync();
  assert(ids(d.products) === "a,b", "2 produits en cache après synchro complète");

  console.log("[2] Synchro delta VIDE (rien changé) : le stock NE disparaît PAS");
  syncPayload = { now: "2026-08-01T10:01:00Z", products: [] };
  d = await NK.reads.sync();
  assert(ids(d.products) === "a,b", "toujours 2 produits (fusion, pas remplacement)");
  assert(ids(NK.cache.read().products) === "a,b", "cache conservé");

  console.log("[3] Ajout d'un produit (delta) : il s'AJOUTE à la liste");
  syncPayload = { now: "2026-08-01T10:02:00Z", products: [{ id: "c", name_fr: "Ballerines", archived: false }] };
  d = await NK.reads.sync();
  assert(ids(d.products) === "a,b,c", "3 produits (le nouveau s'ajoute, les anciens restent)");

  console.log("[4] Mise à jour d'un produit (delta) : upsert par id, pas de doublon");
  syncPayload = { now: "2026-08-01T10:03:00Z", products: [{ id: "a", name_fr: "Chaussures rentrée", archived: false }] };
  d = await NK.reads.sync();
  assert(d.products.length === 3, "toujours 3 produits (pas de doublon)");
  assert(d.products.find((p) => p.id === "a").name_fr === "Chaussures rentrée", "produit mis à jour");

  console.log("[5] Produit archivé : retiré de la liste");
  syncPayload = { now: "2026-08-01T10:04:00Z", products: [{ id: "b", name_fr: "Sac cartable", archived: true }] };
  d = await NK.reads.sync();
  assert(ids(d.products) === "a,c", "produit archivé retiré");

  console.log(`\nRésultat : ${pass} OK, ${fail} échec(s)`);
  process.exit(fail ? 1 : 0);
})();
