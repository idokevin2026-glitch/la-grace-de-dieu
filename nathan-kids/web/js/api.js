// ============================================================================
// NATHAN KIDS — Client API + file d'attente offline-first (outbox)
// ----------------------------------------------------------------------------
// - Auth : appelle l'Edge Function `auth` (login PIN → JWT).
// - Lectures : PostgREST (tables + RPC d'agrégats) avec le token.
// - Écritures : passées par l'OUTBOX (file locale) → rejouées quand le réseau
//   revient, chacune avec un `idempotencyKey` (ventes) pour éviter les doublons
//   (ARCHITECTURE.md §4). L'état dérivé (stock/soldes) est la vérité serveur :
//   on rejoue des OPÉRATIONS, on ne pousse jamais un état local.
// ============================================================================
const NK = (() => {
  const CFG = window.NK_CONFIG || {};
  const LS = {
    tokens: "nk.tokens",
    shop: "nk.shop",
    user: "nk.user",
    outbox: "nk.outbox",
    cache: "nk.cache",
    since: "nk.since",
  };

  const uuid = () =>
    crypto.randomUUID
      ? crypto.randomUUID()
      : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
        });

  const readJSON = (k, fb) => {
    try {
      const v = localStorage.getItem(k);
      return v ? JSON.parse(v) : fb;
    } catch {
      return fb;
    }
  };
  const writeJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  // Auto-réparation : purge une fois le cache + le curseur de synchro quand la
  // version change. Répare les sessions déjà ouvertes dont le curseur périmé
  // masquait des données (ex. vendeuse avec un stock affiché à 0) — sans
  // déconnexion : le prochain `sync_since` repart de zéro et récupère tout.
  const SYNC_V = "2";
  try {
    if (localStorage.getItem("nk.syncv") !== SYNC_V) {
      localStorage.removeItem(LS.since);
      localStorage.removeItem(LS.cache);
      localStorage.setItem("nk.syncv", SYNC_V);
    }
  } catch {
    /* localStorage indisponible */
  }

  // ---- Session --------------------------------------------------------------
  let tokens = readJSON(LS.tokens, null); // { accessToken, refreshToken }
  let user = readJSON(LS.user, null); // { id, name, role }
  let shop = readJSON(LS.shop, null); // { id, name }

  const isAuthed = () => !!(tokens && tokens.accessToken);
  const isAdmin = () => !!(user && user.role === "admin");
  const getUser = () => user;
  const getShop = () => shop;

  function setSession(res) {
    if (res.accessToken) tokens = { ...(tokens || {}), accessToken: res.accessToken };
    if (res.refreshToken) tokens.refreshToken = res.refreshToken;
    if (res.user) user = res.user;
    if (res.shop) shop = res.shop;
    writeJSON(LS.tokens, tokens);
    writeJSON(LS.user, user);
    writeJSON(LS.shop, shop);
  }

  function logoutLocal() {
    [LS.tokens, LS.user, LS.outbox, LS.cache, LS.since].forEach((k) => localStorage.removeItem(k));
    tokens = null;
    user = null;
  }

  // ---- HTTP bas niveau ------------------------------------------------------
  async function authCall(route, body) {
    const res = await fetch(`${CFG.FUNCTIONS_URL}/auth${route}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: CFG.SUPABASE_ANON_KEY,
        // La clé anon est un JWT valide : on l'envoie aussi en Authorization pour
        // que l'appel passe même si l'Edge Function garde « Verify JWT » activé
        // (les routes /auth/* restent pré-connexion, la fonction fait sa propre logique).
        Authorization: `Bearer ${CFG.SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw data.error || { code: "error", message: "Erreur réseau" };
    return data;
  }

  function restHeaders() {
    return {
      "content-type": "application/json",
      apikey: CFG.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${tokens ? tokens.accessToken : CFG.SUPABASE_ANON_KEY}`,
      Prefer: "return=representation", // renvoie la ligne créée/modifiée (insert/patch)
    };
  }

  // Rafraîchissement « single-flight » : une seule rotation à la fois, partagée
  // par toutes les requêtes concurrentes (sinon un 2e /refresh avec l'ancien
  // jeton déclencherait la détection de rejeu et couperait la session).
  let refreshing = null;
  function doRefresh() {
    if (!refreshing) {
      refreshing = authCall("/refresh", { refreshToken: tokens.refreshToken })
        .then((r) => {
          setSession(r); // r = { accessToken, refreshToken } (rotation)
          return r;
        })
        .finally(() => {
          refreshing = null;
        });
    }
    return refreshing;
  }

  // Appel PostgREST avec rafraîchissement transparent du token sur 401.
  async function rest(method, path, body, _retried) {
    const res = await fetch(`${CFG.SUPABASE_URL}/rest/v1/${path}`, {
      method,
      headers: restHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401 && tokens && tokens.refreshToken && !_retried) {
      try {
        await doRefresh();
        return rest(method, path, body, true);
      } catch {
        logoutLocal();
        throw { code: "unauthenticated", message: "Session expirée" };
      }
    }
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) throw (data && data.error) || { code: "error", message: res.statusText, status: res.status };
    return data;
  }

  const rpc = (fn, args) => rest("POST", `rpc/${fn}`, args || {});
  const get = (path) => rest("GET", path);

  // Repart d'une synchro NEUVE : vide le cache local et le curseur `since` pour
  // forcer un `sync_since` complet. Indispensable à la connexion (sinon un
  // curseur/cache laissé par une session précédente masque les données de la
  // boutique — ex. une vendeuse voit un stock vide).
  function resetSyncState() {
    localStorage.removeItem(LS.since);
    localStorage.removeItem(LS.cache);
  }

  // ---- Auth publique --------------------------------------------------------
  const auth = {
    async signup(payload) {
      resetSyncState();
      const r = await authCall("/signup", payload);
      setSession(r);
      return r;
    },
    async login(shopId, pin) {
      resetSyncState();
      const r = await authCall("/login", { shopId, pin });
      setSession({ ...r, shop: shop || { id: shopId } });
      writeJSON(LS.shop, shop || { id: shopId });
      return r;
    },
    resetPin: (payload) => authCall("/reset-pin", payload),
    async logout() {
      try {
        if (navigator.onLine) await rpc("attendance_logout", {});
      } catch {
        /* ignore */
      }
      // Révoque le refresh token côté serveur (rotation/révocation).
      try {
        if (navigator.onLine && tokens && tokens.refreshToken) {
          await authCall("/logout", { refreshToken: tokens.refreshToken });
        }
      } catch {
        /* ignore */
      }
      logoutLocal();
    },
  };

  // ---- Outbox (écritures offline-first) -------------------------------------
  const outbox = {
    all: () => readJSON(LS.outbox, []),
    _save: (q) => writeJSON(LS.outbox, q),
    count() {
      return this.all().length;
    },
    // Empile une opération; renvoie son enveloppe locale.
    enqueue(fn, args) {
      const q = this.all();
      const item = { id: uuid(), fn, args, ts: Date.now() };
      q.push(item);
      this._save(q);
      return item;
    },
    // Rejoue la file dans l'ordre. Arrête au 1er échec RÉSEAU (on retentera).
    // Une erreur MÉTIER (4xx) retire l'item et le consigne pour réconciliation.
    async flush() {
      if (!navigator.onLine || !isAuthed()) return { done: 0, failed: 0 };
      let done = 0,
        failed = 0;
      let q = this.all();
      while (q.length) {
        const item = q[0];
        try {
          await rpc(item.fn, item.args);
          done++;
          q = this.all();
          q.shift();
          this._save(q);
        } catch (e) {
          if (e && (e.code === "error" || e.status === undefined) && !e.status) {
            // pas de réponse serveur => réseau : on stoppe, on garde la file
            break;
          }
          // erreur métier : on retire et on note l'échec (à réconcilier côté UI)
          failed++;
          const dead = readJSON("nk.failed", []);
          dead.push({ ...item, error: e });
          writeJSON("nk.failed", dead);
          q = this.all();
          q.shift();
          this._save(q);
        }
      }
      return { done, failed };
    },
    failures: () => readJSON("nk.failed", []),
    clearFailures: () => localStorage.removeItem("nk.failed"),
  };

  // ---- Opérations métier (écritures) ----------------------------------------
  // Chaque opération est mise en file puis flushée. La vente porte un
  // idempotencyKey pour un rejeu sûr.
  const ops = {
    finalizeSale(lines, method, customerName) {
      outbox.enqueue("finalize_sale", {
        p_lines: lines,
        p_method: method,
        p_customer_name: customerName || null,
        p_idempotency_key: uuid(),
      });
      return outbox.flush();
    },
    payCredit(id) {
      outbox.enqueue("pay_credit", { p_credit_id: id });
      return outbox.flush();
    },
    restock(productId, qty, newCost) {
      outbox.enqueue("restock", { p_product_id: productId, p_qty: qty, p_new_cost: newCost ?? null });
      return outbox.flush();
    },
    adjust(productId, delta) {
      outbox.enqueue("adjust_stock", { p_product_id: productId, p_delta: delta });
      return outbox.flush();
    },
    inventory(counts) {
      outbox.enqueue("inventory_count", { p_counts: counts });
      return outbox.flush();
    },
    moneyMove(type, target, amount) {
      outbox.enqueue("money_move", { p_type: type, p_target: target, p_amount: amount });
      return outbox.flush();
    },
    addStaff(name, pin) {
      return rpc("auth_add_staff", { p_name: name, p_pin: pin });
    },
    removeStaff(id) {
      return rpc("auth_remove_staff", { p_user_id: id });
    },
    // Réinitialise le PIN d'une vendeuse (admin) — sans SMS. Requiert la
    // migration 0010 (fonction auth_set_staff_pin).
    setStaffPin(userId, pin) {
      return rpc("auth_set_staff_pin", { p_user_id: userId, p_new_pin: pin });
    },
    // Modification d'un produit (admin). PATCH partiel ; la RLS vérifie l'admin.
    updateProduct(id, patch) {
      return rest("PATCH", `products?id=eq.${encodeURIComponent(id)}&select=*`, patch);
    },
    // Création de produit (admin). shop_id injecté depuis la session ; la RLS
    // vérifie `shop_id = auth_shop_id()`. Écriture en ligne (retour de la ligne).
    createProduct(p) {
      const shopId = (shop && shop.id) || null;
      return rest("POST", "products?select=*", { ...p, shop_id: shopId });
    },
  };

  // ---- Lectures / cache local ----------------------------------------------
  const cache = {
    read: () => readJSON(LS.cache, {}),
    write: (c) => writeJSON(LS.cache, c),
  };

  const reads = {
    // Produits via la vue products_api (cost masqué au staff par la RLS).
    products: () => get("products_api?select=*&order=name_fr.asc"),
    byBarcode: (code) => get(`products_api?select=*&barcode=eq.${encodeURIComponent(code)}&limit=1`),
    credits: (status) =>
      get(`credits?select=*${status ? `&paid=eq.${status === "paid"}` : ""}&order=created_at.desc`),
    customers: () => get("customers?select=*&order=name.asc"),
    staff: () => get("users?select=id,name,active,role&order=name.asc"),
    dailySheet: (date, tz) => rpc("sales_daily", { p_date: date, p_tz: tz || "UTC" }),
    accounts: () => get("accounts?select=kind,balance"), // admin only (RLS)
    // Pointage : sessions de présence (avec le nom de la vendeuse par embed FK).
    attendance: (fromISO) =>
      get(
        `attendance_sessions?select=id,login_at,logout_at,active,user_id,users(name)` +
          (fromISO ? `&login_at=gte.${encodeURIComponent(fromISO)}` : "") +
          `&order=login_at.desc`,
      ),
    // Journal des mouvements de stock (entrées/sorties), plus récents d'abord.
    movements: (limit = 60) =>
      get(`stock_movements?select=id,product_name,direction,qty,reason,created_at&order=created_at.desc&limit=${limit}`),
    // Ventes d'une fenêtre (graphe hebdo) — total + date seulement (aucune marge exposée).
    weekSales: (fromISO) =>
      get(`sales?select=total,created_at&created_at=gte.${encodeURIComponent(fromISO)}&order=created_at.asc`),
    // Dates de vente par produit (pour le « stock mort ») — mouvements de sortie
    // de type vente, plus récents d'abord ; la 1re occurrence d'un produit = sa
    // dernière vente. Aucun montant/marge exposé.
    saleTimes: (limit = 1000) =>
      get(`stock_movements?select=product_id,created_at&reason=eq.sale&order=created_at.desc&limit=${limit}`),
    // Sync incrémental : met à jour le cache local et le curseur.
    async sync() {
      const since = localStorage.getItem(LS.since) || "1970-01-01T00:00:00Z";
      const data = await rpc("sync_since", { p_since: since });
      const c = cache.read();
      if (data.products) c.products = data.products;
      if (data.accounts) c.accounts = data.accounts;
      // Repli hors ligne pour les écrans Pointage / Mouvements (données du delta).
      if (data.attendance) c.attendance = data.attendance;
      if (data.stockMovements) c.stockMovements = data.stockMovements;
      cache.write(c);
      if (data.now) localStorage.setItem(LS.since, data.now);
      return data;
    },
  };

  // Indicateurs dérivés (BUSINESS_LOGIC.md §8) — calculés sur le cache produits.
  function indicators(products) {
    const p = products || cache.read().products || [];
    const lowCount = p.filter((x) => x.stock > 0 && x.stock <= x.threshold).length;
    const outCount = p.filter((x) => x.stock === 0).length;
    const stockValue = p.reduce((a, x) => a + x.price * x.stock, 0);
    const units = p.reduce((a, x) => a + x.stock, 0);
    return { lowCount, outCount, stockValue, units, skuCount: p.length };
  }

  // Rejoue la file dès que la connexion revient.
  window.addEventListener("online", () => outbox.flush());

  return {
    cfg: CFG,
    uuid,
    isAuthed,
    isAdmin,
    getUser,
    getShop,
    setShop: (s) => {
      // Changement de boutique (ex. lien ?shop=) → repartir d'une synchro neuve.
      const changed = !shop || !s || shop.id !== s.id;
      shop = s;
      writeJSON(LS.shop, s);
      if (changed) resetSyncState();
    },
    auth,
    rpc,
    get,
    ops,
    outbox,
    reads,
    cache,
    indicators,
  };
})();

if (typeof module !== "undefined") module.exports = NK; // tests Node
