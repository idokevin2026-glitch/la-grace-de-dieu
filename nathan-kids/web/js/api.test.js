// Harness Node : valide l'outbox offline-first de api.js sans navigateur.
const store = new Map();
global.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
let online = true;
// Node 22 expose un `navigator` natif en lecture seule → on force le remplacement.
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  get: () => ({ get onLine() { return online; } }),
});
global.crypto = require("crypto").webcrypto;
const listeners = {};
global.window = {
  NK_CONFIG: { SUPABASE_URL: "http://x", SUPABASE_ANON_KEY: "anon", FUNCTIONS_URL: "http://x/fn" },
  addEventListener: (ev, fn) => (listeners[ev] = fn),
};

// fetch mockable
let fetchImpl;
global.fetch = (...a) => fetchImpl(...a);
const okResp = (obj) => ({ ok: true, status: 200, text: async () => JSON.stringify(obj), json: async () => obj });
const errResp = (status, err) => ({ ok: false, status, text: async () => JSON.stringify({ error: err }), json: async () => ({ error: err }) });

// simuler une session authentifiée AVANT le chargement du module
// (api.js lit les tokens du localStorage à l'initialisation, comme au chargement de la page)
store.set("nk.tokens", JSON.stringify({ accessToken: "a", refreshToken: "r" }));
store.set("nk.user", JSON.stringify({ id: "u1", name: "Aicha", role: "staff" }));
const NK = require("/home/user/la-grace-de-dieu/nathan-kids/web/js/api.js");

let pass = 0, fail = 0;
const assert = (cond, msg) => (cond ? (pass++, console.log("  ✓", msg)) : (fail++, console.log("  ✗ ÉCHEC:", msg)));

(async () => {
  console.log("[1] Vente HORS LIGNE : mise en file, aucun appel réseau");
  online = false;
  let calls = 0;
  fetchImpl = async () => { calls++; return okResp([]); };
  await NK.ops.finalizeSale([{ productId: "p1", qty: 2 }], "especes", null);
  assert(NK.outbox.count() === 1, "1 opération en file");
  assert(calls === 0, "aucun appel réseau hors ligne");
  const item = NK.outbox.all()[0];
  assert(item.fn === "finalize_sale" && item.args.p_idempotency_key, "vente avec idempotencyKey");

  console.log("[2] Retour EN LIGNE : la file est drainée (flush)");
  online = true;
  const sent = [];
  fetchImpl = async (url, opt) => { sent.push(JSON.parse(opt.body)); return okResp([{ id: "s1" }]); };
  const r = await NK.outbox.flush();
  assert(r.done === 1 && NK.outbox.count() === 0, "file vidée après flush");
  assert(sent[0].p_idempotency_key === item.args.p_idempotency_key, "même idempotencyKey rejoué (anti-doublon)");

  console.log("[3] Erreur MÉTIER (422) : item retiré + consigné pour réconciliation");
  NK.ops.restock("p1", 5, null); // enqueue (online → flush inside)
  fetchImpl = async () => errResp(422, { code: "insufficient_stock", message: "insufficient_stock", status: 422 });
  await NK.outbox.flush();
  assert(NK.outbox.count() === 0, "item métier en échec retiré de la file");
  assert(NK.outbox.failures().length >= 1, "échec consigné (nk.failed)");

  console.log("[4] Coupure réseau pendant flush : l'item RESTE en file");
  NK.outbox.clearFailures();
  online = true;
  NK.outbox.enqueue("adjust_stock", { p_product_id: "p1", p_delta: -1 });
  fetchImpl = async () => { throw new TypeError("Failed to fetch"); };
  const r4 = await NK.outbox.flush();
  assert(NK.outbox.count() === 1, "item conservé après échec réseau");
  assert(r4.done === 0, "rien de confirmé");

  console.log(`\nRésultat : ${pass} OK, ${fail} échec(s)`);
  process.exit(fail ? 1 : 0);
})();
