// ============================================================================
// NATHAN KIDS — PWA (vanilla JS, sans build). Recâble l'UX du prototype sur
// l'API réelle. Rôles : `admin` voit les finances, `staff` ventes+stock.
// ============================================================================
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const app = $("#app");
  const fmt = (n) => (n == null ? "—" : new Intl.NumberFormat("fr-FR").format(n) + " F");
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const today = () => new Date().toISOString().slice(0, 10);

  // ---- État applicatif ------------------------------------------------------
  const state = {
    screen: "home",
    products: [],
    cart: {}, // { productId: qty }
    method: "especes",
    customer: "",
  };

  // ---- Toast ----------------------------------------------------------------
  let toastT;
  function toast(msg, kind = "ok") {
    let t = $("#toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "toast";
      document.body.appendChild(t);
    }
    t.className = `toast ${kind} show`;
    t.textContent = msg;
    clearTimeout(toastT);
    toastT = setTimeout(() => (t.className = "toast"), 2600);
  }

  function errMsg(e) {
    const m = e && (e.message || e.code);
    const map = {
      insufficient_stock: "Stock insuffisant.",
      invalid_pin: "Code incorrect.",
      conflict: "Déjà enregistré.",
      forbidden: "Accès réservé à l'administrateur.",
      unauthenticated: "Session expirée, reconnectez-vous.",
    };
    return map[e && e.code] || m || "Erreur.";
  }

  // ---- Bandeau outbox (opérations en attente) -------------------------------
  function outboxBadge() {
    const n = NK.outbox.count();
    if (!n) return "";
    return `<span class="badge warn" title="opérations en attente de synchronisation">⌛ ${n}</span>`;
  }

  // ========================================================================
  //  AUTHENTIFICATION (pavé PIN)
  // ========================================================================
  function renderAuth(mode = "login") {
    // mode: login | signup
    let pin = "";
    let pinConfirm = null; // pour signup : 1re saisie mémorisée
    const shop = NK.getShop();
    const needShop = mode === "signup" || !shop;

    app.innerHTML = `
      <div class="auth">
        <div class="brand"><span class="logo">🧸</span><h1>NATHAN KIDS</h1><p>Gestion boutique</p></div>
        ${
          mode === "signup"
            ? `<div class="signup-fields">
                 <input id="su-shop" placeholder="Nom de la boutique" value="NATHAN KIDS"/>
                 <input id="su-owner" placeholder="Votre nom (admin)"/>
                 <input id="su-phone" placeholder="Téléphone (+225…)"/>
               </div>`
            : needShop
              ? `<input id="li-shop" class="shop-input" placeholder="Identifiant boutique (shopId)"/>`
              : `<p class="shop-name">${esc(shop.name || "Boutique")}</p>`
        }
        <p class="pin-label">${mode === "signup" ? "Choisissez un code à 4 chiffres" : "Entrez votre code"}</p>
        <div class="pin-dots" id="pin-dots"></div>
        <div class="pinpad" id="pinpad">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9, "←", 0, "OK"]
            .map((k) => `<button class="key" data-k="${k}">${k}</button>`)
            .join("")}
        </div>
        <button class="link" id="toggle-mode">${
          mode === "signup" ? "← J'ai déjà un compte" : "Première utilisation ? Créer la boutique"
        }</button>
        ${mode === "login" ? '<button class="link" id="forgot">Code oublié ?</button>' : ""}
      </div>`;

    const dots = $("#pin-dots");
    const drawDots = () => (dots.innerHTML = [0, 1, 2, 3].map((i) => `<span class="${i < pin.length ? "on" : ""}"></span>`).join(""));
    drawDots();

    async function submit() {
      if (pin.length !== 4) return;
      try {
        if (mode === "signup") {
          if (pinConfirm === null) {
            pinConfirm = pin;
            pin = "";
            drawDots();
            $(".pin-label").textContent = "Confirmez le code";
            return;
          }
          if (pinConfirm !== pin) {
            toast("Les codes ne correspondent pas", "err");
            pin = "";
            pinConfirm = null;
            drawDots();
            $(".pin-label").textContent = "Choisissez un code à 4 chiffres";
            return;
          }
          await NK.auth.signup({
            shopName: $("#su-shop").value.trim(),
            owner: $("#su-owner").value.trim(),
            phone: $("#su-phone").value.trim(),
            pin,
          });
          toast("Boutique créée ✓");
          boot();
        } else {
          const shopId = shop ? shop.id : $("#li-shop") && $("#li-shop").value.trim();
          if (!shopId) return toast("Identifiant boutique requis", "err");
          if (!shop) NK.setShop({ id: shopId });
          await NK.auth.login(shopId, pin);
          toast("Bienvenue ✓");
          boot();
        }
      } catch (e) {
        toast(errMsg(e), "err");
        pin = "";
        pinConfirm = mode === "signup" ? null : pinConfirm;
        drawDots();
      }
    }

    $("#pinpad").onclick = (ev) => {
      const k = ev.target.dataset.k;
      if (k === undefined) return;
      if (k === "←") pin = pin.slice(0, -1);
      else if (k === "OK") return submit();
      else if (pin.length < 4) pin += k;
      drawDots();
      if (pin.length === 4 && k !== "OK") setTimeout(submit, 120);
    };
    $("#toggle-mode").onclick = () => renderAuth(mode === "signup" ? "login" : "signup");
    const forgot = $("#forgot");
    if (forgot) forgot.onclick = renderReset;
  }

  // Réinitialisation du PIN par OTP SMS (2 étapes : envoi du code, puis pose).
  function renderReset() {
    const shop = NK.getShop();
    app.innerHTML = `
      <div class="auth">
        <div class="brand"><span class="logo">🔑</span><h1>Code oublié</h1><p>Un code SMS sera envoyé au numéro de l'administratrice.</p></div>
        <div class="signup-fields">
          ${shop ? "" : '<input id="rs-shop" placeholder="Identifiant boutique (shopId)"/>'}
          <input id="rs-phone" placeholder="Téléphone de l'admin (+225…)"/>
          <button class="primary big" id="rs-send">Envoyer le code</button>
        </div>
        <div class="signup-fields" id="rs-step2" style="display:none">
          <input id="rs-code" placeholder="Code reçu (6 chiffres)" inputmode="numeric" maxlength="6"/>
          <input id="rs-pin" placeholder="Nouveau code PIN (4 chiffres)" inputmode="numeric" maxlength="4"/>
          <button class="primary big" id="rs-set">Valider le nouveau code</button>
        </div>
        <button class="link" id="rs-back">← Retour</button>
      </div>`;
    const shopId = () => (shop ? shop.id : ($("#rs-shop") ? $("#rs-shop").value.trim() : ""));
    $("#rs-back").onclick = () => renderAuth("login");
    $("#rs-send").onclick = async () => {
      const sid = shopId();
      const phone = $("#rs-phone").value.trim();
      if (!sid || !phone) return toast("Boutique et téléphone requis", "err");
      if (!shop) NK.setShop({ id: sid });
      try {
        const r = await NK.auth.resetPin({ shopId: sid, step: "request", phone });
        $("#rs-step2").style.display = "grid";
        toast(r.delivered ? "Code envoyé par SMS ✓" : "Si le numéro correspond, un code a été envoyé.");
      } catch (e) {
        toast(errMsg(e), "err");
      }
    };
    $("#rs-set").onclick = async () => {
      const sid = shopId();
      const phone = $("#rs-phone").value.trim();
      const code = $("#rs-code").value.trim();
      const newPin = $("#rs-pin").value.trim();
      if (!/^\d{4}$/.test(newPin)) return toast("Le PIN doit faire 4 chiffres", "err");
      try {
        await NK.auth.resetPin({ shopId: sid, step: "set", phone, code, newPin });
        toast("Code réinitialisé ✓ Connectez-vous.");
        renderAuth("login");
      } catch (e) {
        toast(errMsg(e), "err");
      }
    };
  }

  // ========================================================================
  //  COQUILLE (barre du haut + navigation du bas)
  // ========================================================================
  function shell(title, bodyHTML) {
    const admin = NK.isAdmin();
    const nav = [
      ["home", "Accueil", "🏠"],
      ["sales", "Vente", "🛒"],
      ["stock", "Stock", "📦"],
      ["credits", "Crédits", "📕"],
      admin ? ["cash", "Caisse", "💰"] : ["daily", "Journée", "📊"],
    ];
    app.innerHTML = `
      <header class="topbar">
        <div><strong>${esc(title)}</strong><small>${esc((NK.getUser() || {}).name || "")} · ${admin ? "admin" : "vendeuse"}</small></div>
        <div class="top-actions">${outboxBadge()}<button class="icon" id="btn-sync" title="Synchroniser">↻</button><button class="icon" id="btn-logout" title="Déconnexion">⎋</button></div>
      </header>
      <main class="content">${bodyHTML}</main>
      <nav class="tabbar">
        ${nav
          .map(([id, label, ic]) => `<button class="tab ${state.screen === id ? "active" : ""}" data-nav="${id}"><span>${ic}</span>${label}</button>`)
          .join("")}
      </nav>`;
    $(".tabbar").onclick = (e) => {
      const id = e.target.closest("[data-nav]") && e.target.closest("[data-nav]").dataset.nav;
      if (id) go(id);
    };
    $("#btn-logout").onclick = async () => {
      await NK.auth.logout();
      renderAuth("login");
    };
    $("#btn-sync").onclick = () => refresh(true);
  }

  // ========================================================================
  //  ÉCRANS
  // ========================================================================
  async function screenHome() {
    const ind = NK.indicators(state.products);
    let daily = null;
    try {
      daily = await NK.reads.dailySheet(today(), tz());
    } catch {
      /* hors ligne : pas de fiche */
    }
    const admin = NK.isAdmin();
    shell(
      "NATHAN KIDS",
      `
      <section class="cards">
        <div class="card"><span class="k">Articles</span><span class="v">${ind.skuCount}</span></div>
        <div class="card ${ind.lowCount ? "warn" : ""}"><span class="k">Stock bas</span><span class="v">${ind.lowCount}</span></div>
        <div class="card ${ind.outCount ? "danger" : ""}"><span class="k">Ruptures</span><span class="v">${ind.outCount}</span></div>
        <div class="card"><span class="k">Unités</span><span class="v">${ind.units}</span></div>
      </section>
      <h3>Aujourd'hui</h3>
      <section class="cards">
        <div class="card big"><span class="k">Ventes</span><span class="v">${daily ? daily.count : "—"}</span></div>
        <div class="card big"><span class="k">Recette</span><span class="v">${daily ? fmt(daily.revenue) : "—"}</span></div>
        ${admin ? `<div class="card big"><span class="k">Bénéfice</span><span class="v">${daily ? fmt(daily.profit) : "—"}</span></div>` : ""}
        <div class="card big"><span class="k">Panier moy.</span><span class="v">${daily ? fmt(daily.avgBasket) : "—"}</span></div>
      </section>
      ${admin ? `<h3>Valeur du stock</h3><section class="cards"><div class="card big"><span class="k">Valorisation</span><span class="v">${fmt(ind.stockValue)}</span></div></section>` : ""}
    `,
    );
  }

  function cartLines() {
    return Object.entries(state.cart).map(([pid, qty]) => {
      const p = state.products.find((x) => String(x.id) === String(pid));
      return { p, qty };
    });
  }
  function cartTotal() {
    return cartLines().reduce((a, { p, qty }) => a + (p ? p.price * qty : 0), 0);
  }

  function screenSales() {
    const lines = cartLines();
    const total = cartTotal();
    const methods = [
      ["especes", "Espèces"],
      ["wave", "Wave"],
      ["om", "Orange M."],
      ["card", "Carte"],
      ["credit", "Crédit"],
    ];
    shell(
      "Nouvelle vente",
      `
      <div class="search-row">
        <input id="q" class="search" placeholder="Rechercher un article…"/>
        <button class="scan-btn" id="scan" title="Scanner un code-barres">📷</button>
      </div>
      <div class="grid" id="prod-grid">
        ${state.products
          .map(
            (p) => `
          <button class="prod ${p.stock <= 0 ? "off" : ""}" data-add="${p.id}" ${p.stock <= 0 ? "disabled" : ""}>
            <span class="pn">${esc(p.name_fr)}</span>
            <span class="pp">${fmt(p.price)}</span>
            <span class="ps ${p.stock <= 0 ? "z" : p.stock <= p.threshold ? "low" : ""}">stock ${p.stock}</span>
          </button>`,
          )
          .join("")}
      </div>
      <div class="cart">
        <h3>Panier <span class="badge">${lines.length}</span></h3>
        ${
          lines.length
            ? lines
                .map(
                  ({ p, qty }) => `
          <div class="cl">
            <span>${esc(p ? p.name_fr : "?")}</span>
            <div class="qty">
              <button data-dec="${p.id}">−</button><b>${qty}</b><button data-inc="${p.id}">+</button>
            </div>
            <span>${fmt(p ? p.price * qty : 0)}</span>
          </div>`,
                )
                .join("")
            : `<p class="muted">Panier vide — touchez un article.</p>`
        }
        <div class="methods">${methods.map(([m, l]) => `<button class="m ${state.method === m ? "on" : ""}" data-m="${m}">${l}</button>`).join("")}</div>
        ${state.method === "credit" ? `<input id="cust" class="search" placeholder="Nom du client (obligatoire)" value="${esc(state.customer)}"/>` : ""}
        <button class="primary big" id="checkout" ${lines.length ? "" : "disabled"}>Encaisser ${fmt(total)}</button>
      </div>`,
    );

    const grid = $("#prod-grid");
    $("#q").oninput = (e) => {
      const q = e.target.value.toLowerCase();
      grid.querySelectorAll(".prod").forEach((el) => {
        const p = state.products.find((x) => String(x.id) === el.dataset.add);
        el.style.display = p && p.name_fr.toLowerCase().includes(q) ? "" : "none";
      });
    };
    app.querySelector(".content").onclick = (e) => {
      const add = e.target.closest("[data-add]");
      const inc = e.target.closest("[data-inc]");
      const dec = e.target.closest("[data-dec]");
      const m = e.target.closest("[data-m]");
      if (add) addToCart(add.dataset.add);
      else if (inc) incCart(inc.dataset.inc, +1);
      else if (dec) incCart(dec.dataset.dec, -1);
      else if (m) {
        state.method = m.dataset.m;
        screenSales();
      }
    };
    const cust = $("#cust");
    if (cust) cust.oninput = (e) => (state.customer = e.target.value);
    $("#checkout").onclick = checkout;
    $("#scan").onclick = scan;
  }

  // Scan code-barres : BarcodeDetector si dispo (caméra), sinon saisie manuelle.
  // Résout d'abord dans le cache local (offline), puis interroge l'API.
  async function scan() {
    let code = null;
    if ("BarcodeDetector" in window && navigator.mediaDevices) {
      try {
        code = await scanCamera();
      } catch {
        /* repli saisie manuelle */
      }
    }
    if (!code) code = (prompt("Code-barres (ou saisie manuelle) :") || "").trim();
    if (!code) return;
    let p = state.products.find((x) => x.barcode === code);
    if (!p) {
      try {
        const rows = await NK.reads.byBarcode(code);
        p = rows && rows[0];
      } catch {
        /* offline */
      }
    }
    if (!p) return toast("Article inconnu pour ce code", "err");
    addToCart(p.id);
    toast(`+ ${p.name_fr}`);
  }

  function scanCamera() {
    return new Promise(async (resolve, reject) => {
      try {
        const det = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "code_128", "upc_a"] });
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        const overlay = document.createElement("div");
        overlay.className = "scan-overlay";
        const video = document.createElement("video");
        video.setAttribute("playsinline", "");
        video.srcObject = stream;
        await video.play();
        const close = document.createElement("button");
        close.textContent = "Fermer";
        close.className = "primary";
        overlay.append(video, close);
        document.body.appendChild(overlay);
        let done = false;
        const stop = (val, err) => {
          if (done) return;
          done = true;
          stream.getTracks().forEach((t) => t.stop());
          overlay.remove();
          err ? reject(err) : resolve(val);
        };
        close.onclick = () => stop(null);
        const tick = async () => {
          if (done) return;
          try {
            const codes = await det.detect(video);
            if (codes && codes.length) return stop(codes[0].rawValue);
          } catch {
            /* continue */
          }
          requestAnimationFrame(tick);
        };
        tick();
      } catch (e) {
        reject(e);
      }
    });
  }

  function stockOf(pid) {
    const p = state.products.find((x) => String(x.id) === String(pid));
    return p ? p.stock : 0;
  }
  function addToCart(pid) {
    if (stockOf(pid) <= 0) return toast("Rupture de stock", "err");
    const cur = state.cart[pid] || 0;
    if (cur + 1 > stockOf(pid)) return toast("Quantité > stock", "err");
    state.cart[pid] = cur + 1;
    screenSales();
  }
  function incCart(pid, d) {
    const cur = state.cart[pid] || 0;
    const next = cur + d;
    if (next <= 0) delete state.cart[pid];
    else if (next > stockOf(pid)) return toast("Quantité > stock", "err");
    else state.cart[pid] = next;
    screenSales();
  }

  async function checkout() {
    const lines = cartLines();
    if (!lines.length) return;
    if (state.method === "credit" && !state.customer.trim()) return toast("Indique le nom du client", "err");
    const payload = lines.map(({ p, qty }) => ({ productId: p.id, qty }));
    // Décrément optimiste local (l'API reste la vérité, resync ensuite)
    lines.forEach(({ p, qty }) => (p.stock = Math.max(0, p.stock - qty)));
    const cust = state.customer.trim();
    state.cart = {};
    state.customer = "";
    const m = state.method;
    state.method = "especes";
    try {
      const r = await NK.ops.finalizeSale(payload, m, cust || null);
      if (NK.outbox.count() > 0) toast("Vente en file (hors ligne) ⌛");
      else toast(m === "credit" ? "Vente à crédit enregistrée ✓" : "Vente enregistrée ✓");
    } catch (e) {
      toast(errMsg(e), "err");
    }
    await refresh(false);
  }

  async function screenStock() {
    const admin = NK.isAdmin();
    shell(
      "Stock",
      `
      <div class="stock-actions">
        <button id="inv-btn">📋 Inventaire</button>
        ${admin ? `<button id="add-prod-btn">＋ Produit</button>` : ""}
      </div>
      <input id="q" class="search" placeholder="Rechercher…"/>
      <div class="list" id="stock-list">
        ${state.products
          .map(
            (p) => `
          <div class="row" data-p="${p.id}">
            <div class="row-main">
              <strong>${esc(p.name_fr)}</strong>
              <small>${esc(p.category)}${admin && p.cost != null ? ` · coût ${fmt(p.cost)}` : ""} · ${fmt(p.price)}</small>
            </div>
            <span class="pill ${p.stock === 0 ? "z" : p.stock <= p.threshold ? "low" : "ok"}">${p.stock}</span>
            <div class="row-act">
              <button data-restock="${p.id}">+ Réassort</button>
              <button data-adjust="${p.id}">± Ajuster</button>
            </div>
          </div>`,
          )
          .join("")}
      </div>`,
    );
    $("#q").oninput = (e) => {
      const q = e.target.value.toLowerCase();
      $("#stock-list")
        .querySelectorAll(".row")
        .forEach((el) => {
          const p = state.products.find((x) => String(x.id) === el.dataset.p);
          el.style.display = p && p.name_fr.toLowerCase().includes(q) ? "" : "none";
        });
    };
    $("#stock-list").onclick = async (e) => {
      const rs = e.target.closest("[data-restock]");
      const aj = e.target.closest("[data-adjust]");
      if (rs) {
        const qty = +prompt("Quantité reçue ?");
        if (!qty || qty <= 0) return;
        const nc = admin ? prompt("Nouveau coût unitaire ? (vide = inchangé)") : "";
        await NK.ops.restock(rs.dataset.restock, qty, nc ? +nc : null);
        toast("Réassort enregistré ✓");
        refresh(false);
      } else if (aj) {
        const d = +prompt("Ajustement (+/−) ?");
        if (!d) return;
        await NK.ops.adjust(aj.dataset.adjust, d);
        toast("Ajustement enregistré ✓");
        refresh(false);
      }
    };
    $("#inv-btn").onclick = () => go("inventory");
    const addBtn = $("#add-prod-btn");
    if (addBtn) addBtn.onclick = addProductModal;
  }

  // Inventaire physique : saisir le comptage réel, n'envoyer que les écarts.
  function screenInventory() {
    shell(
      "Inventaire",
      `
      <p class="muted">Saisissez le stock physiquement compté. Seuls les écarts sont enregistrés.</p>
      <div class="list">
        ${state.products
          .map(
            (p) => `
          <div class="row">
            <div class="row-main"><strong>${esc(p.name_fr)}</strong><small>théorique : ${p.stock}</small></div>
            <input class="count" type="number" min="0" inputmode="numeric" data-c="${p.id}" value="${p.stock}" />
          </div>`,
          )
          .join("")}
      </div>
      <button class="primary big" id="inv-save">Valider l'inventaire</button>
      <button class="link" id="inv-cancel">Annuler</button>`,
    );
    $("#inv-cancel").onclick = () => go("stock");
    $("#inv-save").onclick = async () => {
      const counts = [];
      app.querySelectorAll(".count").forEach((el) => {
        const pid = el.dataset.c;
        const counted = parseInt(el.value, 10);
        const p = state.products.find((x) => String(x.id) === pid);
        if (!Number.isNaN(counted) && p && counted !== p.stock) counts.push({ productId: pid, counted });
      });
      if (!counts.length) return toast("Aucun écart à enregistrer");
      await NK.ops.inventory(counts);
      toast(`${counts.length} écart(s) enregistré(s) ✓`);
      await refresh(false);
      go("stock");
    };
  }

  // Ajout d'un produit (admin). Code-barres EAN-13 valide généré si absent.
  function addProductModal() {
    const body = `
      <h3>Nouveau produit</h3>
      <div class="form">
        <input id="f-fr" placeholder="Nom (français)"/>
        <input id="f-en" placeholder="Nom (anglais)"/>
        <select id="f-cat"><option value="vetements">Vêtements</option><option value="cosmetiques">Cosmétiques</option></select>
        <div class="two"><input id="f-price" type="number" placeholder="Prix de vente"/><input id="f-cost" type="number" placeholder="Coût d'achat"/></div>
        <div class="two"><input id="f-stock" type="number" placeholder="Stock initial" value="0"/><input id="f-thr" type="number" placeholder="Seuil alerte" value="4"/></div>
        <input id="f-sup" placeholder="Fournisseur (optionnel)"/>
        <input id="f-code" placeholder="Code-barres (vide = généré)"/>
      </div>`;
    modal(body, async () => {
      const fr = $("#f-fr").value.trim();
      const en = $("#f-en").value.trim() || fr;
      if (!fr) {
        toast("Nom requis", "err");
        return false;
      }
      let code = $("#f-code").value.trim();
      if (code && !NKBarcode.isValid(code)) {
        toast("Code-barres EAN-13 invalide", "err");
        return false;
      }
      if (!code) code = NKBarcode.generate();
      try {
        await NK.ops.createProduct({
          name_fr: fr,
          name_en: en,
          category: $("#f-cat").value,
          price: +$("#f-price").value || 0,
          cost: +$("#f-cost").value || 0,
          stock: +$("#f-stock").value || 0,
          threshold: +$("#f-thr").value || 4,
          supplier: $("#f-sup").value.trim() || null,
          barcode: code,
        });
        toast("Produit ajouté ✓");
        await refresh(false);
        go("stock");
        return true;
      } catch (e) {
        toast(errMsg(e), "err");
        return false;
      }
    });
  }

  // Modale générique (contenu + action de validation qui renvoie true pour fermer).
  function modal(bodyHTML, onOk) {
    const m = document.createElement("div");
    m.className = "modal-back";
    m.innerHTML = `<div class="modal">${bodyHTML}<div class="modal-actions"><button class="link" data-x>Annuler</button><button class="primary" data-ok>Valider</button></div></div>`;
    document.body.appendChild(m);
    const close = () => m.remove();
    m.querySelector("[data-x]").onclick = close;
    m.onclick = (e) => {
      if (e.target === m) close();
    };
    m.querySelector("[data-ok]").onclick = async () => {
      const ok = await onOk();
      if (ok !== false) close();
    };
  }

  async function screenCredits() {
    let credits = [];
    try {
      credits = await NK.reads.credits("open");
    } catch {
      /* offline */
    }
    shell(
      "Crédits clients",
      `
      <div class="list">
        ${
          credits.length
            ? credits
                .map(
                  (c) => `
          <div class="row">
            <div class="row-main"><strong>${esc(c.customer_name)}</strong><small>${new Date(c.created_at).toLocaleDateString("fr-FR")}</small></div>
            <span class="pill low">${fmt(c.amount)}</span>
            <div class="row-act"><button class="primary" data-pay="${c.id}">Marquer payé</button></div>
          </div>`,
                )
                .join("")
            : `<p class="muted">Aucun crédit en cours 🎉</p>`
        }
      </div>`,
    );
    $(".content").onclick = async (e) => {
      const pay = e.target.closest("[data-pay]");
      if (!pay) return;
      if (!confirm("Confirmer le paiement (créditer la caisse) ?")) return;
      try {
        await NK.ops.payCredit(pay.dataset.pay);
        toast("Crédit soldé ✓");
        screenCredits();
      } catch (er) {
        toast(errMsg(er), "err");
      }
    };
  }

  async function screenDaily() {
    let d = null;
    try {
      d = await NK.reads.dailySheet(today(), tz());
    } catch {
      /* offline */
    }
    const admin = NK.isAdmin();
    shell(
      "Fiche du jour",
      d
        ? `
      <div class="stock-actions">
        <button id="exp-csv">⬇ Excel (CSV)</button>
        <button id="exp-pdf">🖨 PDF</button>
      </div>
      <section class="cards">
        <div class="card big"><span class="k">Recette</span><span class="v">${fmt(d.revenue)}</span></div>
        <div class="card big"><span class="k">Ventes</span><span class="v">${d.count}</span></div>
        ${admin ? `<div class="card big"><span class="k">Bénéfice</span><span class="v">${fmt(d.profit)}</span></div>` : ""}
        <div class="card big"><span class="k">Crédits</span><span class="v">${fmt(d.creditsGiven)}</span></div>
      </section>
      <h3>Par mode de paiement</h3>
      <div class="list">${(d.byPayment || []).map((b) => `<div class="row"><div class="row-main"><strong>${esc(b.method)}</strong></div><span>${fmt(b.amount)}</span></div>`).join("") || '<p class="muted">—</p>'}</div>
      <h3>Articles vendus</h3>
      <div class="list">${(d.itemsSold || []).map((i) => `<div class="row"><div class="row-main"><strong>${esc(i.name)}</strong></div><span>×${i.qty}</span><span>${fmt(i.amount)}</span></div>`).join("") || '<p class="muted">—</p>'}</div>
      <h3>Opérations</h3>
      <div class="list">${(d.operations || []).map((o) => `<div class="row"><div class="row-main"><strong>${esc(o.time)}</strong><small>${esc(o.label)}</small></div><span>${esc(o.method)}</span><span>${fmt(o.amount)}</span></div>`).join("") || '<p class="muted">—</p>'}</div>`
        : `<p class="muted">Indisponible hors ligne.</p>`,
    );
    if (d) {
      const shopName = (NK.getShop() || {}).name || "NATHAN KIDS";
      $("#exp-csv").onclick = () => NKExport.csv(d, admin);
      $("#exp-pdf").onclick = () => {
        if (!NKExport.printPDF(d, admin, shopName)) toast("Autorisez les fenêtres pop-up pour le PDF", "err");
      };
    }
  }

  async function screenCash() {
    if (!NK.isAdmin()) return go("home");
    let acc = { cash: 0, bank: 0 };
    try {
      const rows = await NK.reads.accounts();
      rows.forEach((r) => (acc[r.kind] = r.balance));
    } catch {
      /* offline */
    }
    shell(
      "Caisse & Banque",
      `
      <section class="cards">
        <div class="card big"><span class="k">Caisse (espèces)</span><span class="v">${fmt(acc.cash)}</span></div>
        <div class="card big"><span class="k">Banque</span><span class="v">${fmt(acc.bank)}</span></div>
      </section>
      <div class="money-actions">
        <button data-mv="deposit">➕ Dépôt</button>
        <button data-mv="withdraw">➖ Retrait</button>
        <button data-mv="toBank">🏦 Vers banque</button>
      </div>
      <h3>Équipe</h3>
      <div class="list" id="staff-list"></div>
      <button class="primary" id="add-staff">+ Ajouter une vendeuse</button>`,
    );
    $(".money-actions").onclick = async (e) => {
      const b = e.target.closest("[data-mv]");
      if (!b) return;
      const type = b.dataset.mv;
      const amount = +prompt("Montant (FCFA) ?");
      if (!amount || amount <= 0) return;
      let target = "cash";
      if (type !== "toBank") target = confirm("OK = Caisse, Annuler = Banque") ? "cash" : "bank";
      try {
        await NK.ops.moneyMove(type, target, amount);
        toast("Mouvement enregistré ✓");
        screenCash();
      } catch (er) {
        toast(errMsg(er), "err");
      }
    };
    // équipe
    try {
      const staff = (await NK.reads.staff()).filter((u) => u.role === "staff" && u.active);
      $("#staff-list").innerHTML =
        staff.map((s) => `<div class="row"><div class="row-main"><strong>${esc(s.name)}</strong></div><button data-del="${s.id}">Retirer</button></div>`).join("") ||
        '<p class="muted">Aucune vendeuse.</p>';
      $("#staff-list").onclick = async (e) => {
        const d = e.target.closest("[data-del]");
        if (d && confirm("Désactiver cette vendeuse ?")) {
          await NK.ops.removeStaff(d.dataset.del);
          toast("Vendeuse désactivée");
          screenCash();
        }
      };
    } catch {
      /* offline */
    }
    $("#add-staff").onclick = async () => {
      const name = prompt("Nom de la vendeuse ?");
      if (!name) return;
      const pin = prompt("Code PIN (4 chiffres) ?");
      if (!/^\d{4}$/.test(pin || "")) return toast("PIN invalide", "err");
      try {
        await NK.ops.addStaff(name, pin);
        toast("Vendeuse ajoutée ✓");
        screenCash();
      } catch (er) {
        toast(errMsg(er), "err");
      }
    };
  }

  // ---- Routage --------------------------------------------------------------
  const screens = {
    home: screenHome,
    sales: screenSales,
    stock: screenStock,
    inventory: screenInventory,
    credits: screenCredits,
    daily: screenDaily,
    cash: screenCash,
  };
  function go(id) {
    state.screen = id;
    (screens[id] || screenHome)();
  }

  function tz() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  }

  // ---- Rafraîchissement (sync + cache) --------------------------------------
  async function refresh(rerender) {
    try {
      await NK.outbox.flush();
      const data = await NK.reads.sync();
      if (data.products) state.products = data.products;
    } catch {
      const c = NK.cache.read();
      if (c.products) state.products = c.products;
    }
    if (rerender !== false) go(state.screen);
  }

  async function boot() {
    if (!NK.isAuthed()) return renderAuth(NK.getShop() ? "login" : "signup");
    // Charger le cache immédiatement puis synchroniser.
    const c = NK.cache.read();
    state.products = c.products || [];
    go("home");
    await refresh(true);
  }

  window.addEventListener("online", () => refresh(false));
  boot();
})();
