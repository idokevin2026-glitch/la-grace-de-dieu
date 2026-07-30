// ============================================================================
// NATHAN KIDS — PWA (vanilla JS, sans build). UX orientée boutique, offline-first.
// Rôles : `admin` voit les finances et le pointage, `staff` ventes + stock.
// Design vert « interactif » : dashboard héro, actions rapides, graphe hebdo,
// pointage des vendeuses et journal des mouvements de stock. Bilingue FR/EN.
// ============================================================================
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const app = $("#app");

  // ---- Internationalisation (FR par défaut, bascule EN) ---------------------
  const I18N = {
    fr: {
      hello: "Bonjour", todaySales: "CA DU JOUR", vsYesterday: "vs. hier",
      benefit: "Bénéfice", orders: "Commandes", items: "Articles", clients: "Clients",
      watchStock: "Stock à surveiller", itemsLow: "article(s) bientôt épuisé(s)", seeStock: "Voir le stock",
      quickActions: "Actions rapides", newSale: "Nouvelle vente", stock: "Stock",
      credits: "Crédits", reports: "Rapports", home: "Accueil", sales: "Vente", more: "Plus",
      sync: "Synchroniser", logout: "Déconnexion",
      todayTitle: "Aujourd'hui", articles: "Articles", lowStock: "Stock bas", ruptures: "Ruptures",
      units: "Unités", valuation: "Valorisation stock", panier: "Panier moy.", revenue: "Recette",
      week: "Cette semaine", weekCA: "CA de la semaine", bestDay: "Meilleur jour",
      salesCount: "Nombre de ventes",
      ficheJour: "Fiche du jour", ficheSub: "Synthèse des opérations · PDF / Excel",
      movements: "Mouvements de stock", movementsSub: "Entrées et sorties",
      entries: "Entrées", exits: "Sorties",
      attendance: "Pointage vendeuses", attendanceSub: "Arrivées et départs",
      arrival: "Arrivée", departure: "Départ", ongoing: "en cours", seller: "vendeuse", roleAdmin: "admin",
      cash: "Caisse & Banque", cashSub: "Soldes et mouvements", cashBox: "Caisse (espèces)", bank: "Banque",
      deposit: "Dépôt", withdraw: "Retrait", toBank: "Vers banque",
      team: "Équipe", teamSub: "Vendeuses de la boutique", addSeller: "Ajouter une vendeuse",
      remove: "Retirer", noSeller: "Aucune vendeuse.",
      noCredits: "Aucun crédit en cours 🎉", markPaid: "Marquer payé",
      inventory: "Inventaire", product: "Produit", search: "Rechercher…", cart: "Panier",
      cartEmpty: "Panier vide — touchez un article.", checkout: "Encaisser",
      customerName: "Nom du client (obligatoire)", restock: "Réassort", adjust: "Ajuster",
      reasonSale: "Vente", reasonRestock: "Réassort", reasonAdjust: "Ajustement", reasonInv: "Inventaire",
      deadStock: "Stock mort", deadStockSub: "Articles qui ne se vendent plus", inventoryTile: "Inventaire",
      inventoryHintShort: "Comptage physique",
      neverSold: "Jamais vendu", noSaleSince: "j sans vente", sinceLabel: "Sans vente depuis",
      immobilizedRetail: "Valeur immobilisée", immobilizedCost: "dont au coût",
      deadCount: "article(s) mort(s)", noDeadStock: "Aucun stock mort — tout tourne 🎉",
      gestion: "Gestion", gestionSub: "Outils de suivi", disconnect: "Se déconnecter",
      roleAdminF: "Administratrice", roleStaffF: "Vendeuse",
      noData: "—", offlineData: "Indisponible hors ligne.", byPayment: "Par mode de paiement",
      itemsSold: "Articles vendus", operations: "Opérations", exportCsv: "Excel (CSV)", exportPdf: "PDF",
      inventoryHint: "Saisissez le stock physiquement compté. Seuls les écarts sont enregistrés.",
      validate: "Valider", cancel: "Annuler", theoretical: "théorique",
      pending: "opérations en attente de synchronisation", scan: "Scanner un code-barres",
      espece: "Espèces", waveM: "Wave", omM: "Orange M.", cardM: "Carte", creditM: "Crédit",
    },
    en: {
      hello: "Hello", todaySales: "TODAY'S SALES", vsYesterday: "vs. yesterday",
      benefit: "Profit", orders: "Orders", items: "Items", clients: "Clients",
      watchStock: "Low stock alert", itemsLow: "item(s) running low", seeStock: "View stock",
      quickActions: "Quick actions", newSale: "New sale", stock: "Stock",
      credits: "Credits", reports: "Reports", home: "Home", sales: "Sell", more: "More",
      sync: "Sync", logout: "Log out",
      todayTitle: "Today", articles: "Products", lowStock: "Low stock", ruptures: "Out",
      units: "Units", valuation: "Stock value", panier: "Avg. basket", revenue: "Revenue",
      week: "This week", weekCA: "Weekly sales", bestDay: "Best day",
      salesCount: "Number of sales",
      ficheJour: "Daily sheet", ficheSub: "Operations summary · PDF / Excel",
      movements: "Stock movements", movementsSub: "Ins and outs",
      entries: "In", exits: "Out",
      attendance: "Staff clock-in", attendanceSub: "Arrivals and departures",
      arrival: "In", departure: "Out", ongoing: "ongoing", seller: "seller", roleAdmin: "admin",
      cash: "Cash & Bank", cashSub: "Balances and moves", cashBox: "Cash", bank: "Bank",
      deposit: "Deposit", withdraw: "Withdraw", toBank: "To bank",
      team: "Team", teamSub: "Shop sellers", addSeller: "Add a seller",
      remove: "Remove", noSeller: "No seller yet.",
      noCredits: "No open credit 🎉", markPaid: "Mark paid",
      inventory: "Inventory", product: "Product", search: "Search…", cart: "Cart",
      cartEmpty: "Empty cart — tap a product.", checkout: "Charge",
      customerName: "Customer name (required)", restock: "Restock", adjust: "Adjust",
      reasonSale: "Sale", reasonRestock: "Restock", reasonAdjust: "Adjustment", reasonInv: "Inventory",
      deadStock: "Dead stock", deadStockSub: "Items that no longer sell", inventoryTile: "Inventory",
      inventoryHintShort: "Physical count",
      neverSold: "Never sold", noSaleSince: "d without sale", sinceLabel: "No sale for",
      immobilizedRetail: "Tied-up value", immobilizedCost: "at cost",
      deadCount: "dead item(s)", noDeadStock: "No dead stock — all moving 🎉",
      gestion: "Management", gestionSub: "Tracking tools", disconnect: "Log out",
      roleAdminF: "Administrator", roleStaffF: "Seller",
      noData: "—", offlineData: "Unavailable offline.", byPayment: "By payment method",
      itemsSold: "Items sold", operations: "Operations", exportCsv: "Excel (CSV)", exportPdf: "PDF",
      inventoryHint: "Enter the physically counted stock. Only differences are recorded.",
      validate: "Confirm", cancel: "Cancel", theoretical: "expected",
      pending: "operations awaiting sync", scan: "Scan a barcode",
      espece: "Cash", waveM: "Wave", omM: "Orange M.", cardM: "Card", creditM: "Credit",
    },
  };
  let lang = localStorage.getItem("nk.lang") || "fr";
  const t = (k) => (I18N[lang] && I18N[lang][k]) || I18N.fr[k] || k;
  const setLang = (l) => {
    lang = l;
    localStorage.setItem("nk.lang", l);
  };
  const pn = (p) => (lang === "en" ? p.name_en || p.name_fr : p.name_fr || p.name_en);

  const fmt = (n) =>
    n == null ? t("noData") : new Intl.NumberFormat(lang === "en" ? "en-US" : "fr-FR").format(n) + " F";
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const today = () => new Date().toISOString().slice(0, 10);
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const dateLabel = () =>
    cap(
      new Date().toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    );
  const hhmm = (iso) =>
    new Date(iso).toLocaleTimeString(lang === "en" ? "en-GB" : "fr-FR", { hour: "2-digit", minute: "2-digit" });
  const initials = (name) => {
    const parts = String(name || "?").trim().split(/\s+/);
    const s = parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] || "?").slice(0, 2);
    return s.toUpperCase();
  };
  const durLabel = (fromIso, toIso) => {
    const ms = (toIso ? new Date(toIso) : new Date()) - new Date(fromIso);
    const min = Math.max(0, Math.round(ms / 60000));
    return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
  };

  // ---- État applicatif ------------------------------------------------------
  const state = {
    screen: "home",
    products: [],
    cart: {}, // { productId: qty }
    method: "especes",
    customer: "",
    daily: null, // fiche du jour agrégée
    week: null, // agrégat 7 jours { days, sum, bestIdx, todayTotal, yestTotal }
    deadDays: 60, // seuil « stock mort » (jours sans vente)
  };

  // ---- Toast ----------------------------------------------------------------
  let toastT;
  function toast(msg, kind = "ok") {
    let el = $("#toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      document.body.appendChild(el);
    }
    el.className = `toast ${kind} show`;
    el.textContent = msg;
    clearTimeout(toastT);
    toastT = setTimeout(() => (el.className = "toast"), 2600);
  }

  function errMsg(e) {
    const m = e && (e.message || e.code);
    const map =
      lang === "en"
        ? {
            insufficient_stock: "Not enough stock.",
            invalid_pin: "Wrong code.",
            conflict: "Already recorded.",
            forbidden: "Admin only.",
            unauthenticated: "Session expired, please log in.",
          }
        : {
            insufficient_stock: "Stock insuffisant.",
            invalid_pin: "Code incorrect.",
            conflict: "Déjà enregistré.",
            forbidden: "Accès réservé à l'administrateur.",
            unauthenticated: "Session expirée, reconnectez-vous.",
          };
    return map[e && e.code] || m || (lang === "en" ? "Error." : "Erreur.");
  }

  // ---- Bandeau outbox (opérations en attente) -------------------------------
  function outboxBadge() {
    const n = NK.outbox.count();
    if (!n) return "";
    return `<span class="badge warn" title="${t("pending")}">⌛ ${n}</span>`;
  }

  function wordmarkHTML() {
    const letters = "NATHAN"
      .split("")
      .map((c, i) => `<span class="w${i}">${c}</span>`)
      .join("");
    return `${letters}<span class="wk">KIDS</span>`;
  }

  function langToggleHTML() {
    return `<div class="lang-toggle">
      <button class="${lang === "fr" ? "on" : ""}" data-lang="fr">FR</button>
      <button class="${lang === "en" ? "on" : ""}" data-lang="en">EN</button>
    </div>`;
  }

  // ========================================================================
  //  AUTHENTIFICATION (pavé PIN)
  // ========================================================================
  let authView = "login"; // login | signup | reset (pour re-rendu à la bascule de langue)
  function renderAuth(mode = "login") {
    authView = mode;
    let pin = "";
    let pinConfirm = null;
    const shop = NK.getShop();
    const needShop = mode === "signup" || !shop;

    app.innerHTML = `
      <div class="auth">
        <div class="auth-lang">${langToggleHTML()}</div>
        <div class="brand"><div class="wordmark big">${wordmarkHTML()}</div><p>${
          lang === "en" ? "Shop management" : "Gestion boutique"
        }</p></div>
        ${
          mode === "signup"
            ? `<div class="signup-fields">
                 <input id="su-shop" placeholder="${lang === "en" ? "Shop name" : "Nom de la boutique"}" value="NATHAN KIDS"/>
                 <input id="su-owner" placeholder="${lang === "en" ? "Your name (admin)" : "Votre nom (admin)"}"/>
                 <input id="su-phone" placeholder="${lang === "en" ? "Phone (+225…)" : "Téléphone (+225…)"}"/>
               </div>`
            : needShop
              ? `<input id="li-shop" class="shop-input" placeholder="${
                  lang === "en" ? "Shop ID (shopId)" : "Identifiant boutique (shopId)"
                }"/>`
              : `<p class="shop-name">${esc(shop.name || "Boutique")}</p>`
        }
        <p class="pin-label">${
          mode === "signup"
            ? lang === "en"
              ? "Choose a 4-digit code"
              : "Choisissez un code à 4 chiffres"
            : lang === "en"
              ? "Enter your code"
              : "Entrez votre code"
        }</p>
        <div class="pin-dots" id="pin-dots"></div>
        <div class="pinpad" id="pinpad">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9, "←", 0, "OK"]
            .map((k) => `<button class="key" data-k="${k}">${k}</button>`)
            .join("")}
        </div>
        <button class="link" id="toggle-mode">${
          mode === "signup"
            ? lang === "en"
              ? "← I already have an account"
              : "← J'ai déjà un compte"
            : lang === "en"
              ? "First time? Create the shop"
              : "Première utilisation ? Créer la boutique"
        }</button>
        ${mode === "login" ? `<button class="link" id="forgot">${lang === "en" ? "Forgot code?" : "Code oublié ?"}</button>` : ""}
      </div>`;

    wireLang();
    const dots = $("#pin-dots");
    const drawDots = () =>
      (dots.innerHTML = [0, 1, 2, 3].map((i) => `<span class="${i < pin.length ? "on" : ""}"></span>`).join(""));
    drawDots();

    async function submit() {
      if (pin.length !== 4) return;
      try {
        if (mode === "signup") {
          if (pinConfirm === null) {
            pinConfirm = pin;
            pin = "";
            drawDots();
            $(".pin-label").textContent = lang === "en" ? "Confirm the code" : "Confirmez le code";
            return;
          }
          if (pinConfirm !== pin) {
            toast(lang === "en" ? "Codes do not match" : "Les codes ne correspondent pas", "err");
            pin = "";
            pinConfirm = null;
            drawDots();
            $(".pin-label").textContent =
              lang === "en" ? "Choose a 4-digit code" : "Choisissez un code à 4 chiffres";
            return;
          }
          await NK.auth.signup({
            shopName: $("#su-shop").value.trim(),
            owner: $("#su-owner").value.trim(),
            phone: $("#su-phone").value.trim(),
            pin,
          });
          toast(lang === "en" ? "Shop created ✓" : "Boutique créée ✓");
          boot();
        } else {
          const shopId = shop ? shop.id : $("#li-shop") && $("#li-shop").value.trim();
          if (!shopId) return toast(lang === "en" ? "Shop ID required" : "Identifiant boutique requis", "err");
          if (!shop) NK.setShop({ id: shopId });
          await NK.auth.login(shopId, pin);
          toast(lang === "en" ? "Welcome ✓" : "Bienvenue ✓");
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
    authView = "reset";
    const shop = NK.getShop();
    app.innerHTML = `
      <div class="auth">
        <div class="auth-lang">${langToggleHTML()}</div>
        <div class="brand"><span class="logo">🔑</span><h1>${
          lang === "en" ? "Forgot code" : "Code oublié"
        }</h1><p>${
          lang === "en"
            ? "An SMS code will be sent to the admin's number."
            : "Un code SMS sera envoyé au numéro de l'administratrice."
        }</p></div>
        <div class="signup-fields">
          ${shop ? "" : '<input id="rs-shop" placeholder="Identifiant boutique (shopId)"/>'}
          <input id="rs-phone" placeholder="${lang === "en" ? "Admin phone (+225…)" : "Téléphone de l'admin (+225…)"}"/>
          <button class="primary big" id="rs-send">${lang === "en" ? "Send the code" : "Envoyer le code"}</button>
        </div>
        <div class="signup-fields" id="rs-step2" style="display:none">
          <input id="rs-code" placeholder="${lang === "en" ? "Code received (6 digits)" : "Code reçu (6 chiffres)"}" inputmode="numeric" maxlength="6"/>
          <input id="rs-pin" placeholder="${lang === "en" ? "New PIN (4 digits)" : "Nouveau code PIN (4 chiffres)"}" inputmode="numeric" maxlength="4"/>
          <button class="primary big" id="rs-set">${lang === "en" ? "Set new code" : "Valider le nouveau code"}</button>
        </div>
        <button class="link" id="rs-back">← ${lang === "en" ? "Back" : "Retour"}</button>
      </div>`;
    wireLang();
    const shopId = () => (shop ? shop.id : $("#rs-shop") ? $("#rs-shop").value.trim() : "");
    $("#rs-back").onclick = () => renderAuth("login");
    $("#rs-send").onclick = async () => {
      const sid = shopId();
      const phone = $("#rs-phone").value.trim();
      if (!sid || !phone) return toast(lang === "en" ? "Shop and phone required" : "Boutique et téléphone requis", "err");
      if (!shop) NK.setShop({ id: sid });
      try {
        const r = await NK.auth.resetPin({ shopId: sid, step: "request", phone });
        $("#rs-step2").style.display = "grid";
        toast(
          r.delivered
            ? lang === "en"
              ? "Code sent by SMS ✓"
              : "Code envoyé par SMS ✓"
            : lang === "en"
              ? "If the number matches, a code was sent."
              : "Si le numéro correspond, un code a été envoyé.",
        );
      } catch (e) {
        toast(errMsg(e), "err");
      }
    };
    $("#rs-set").onclick = async () => {
      const sid = shopId();
      const phone = $("#rs-phone").value.trim();
      const code = $("#rs-code").value.trim();
      const newPin = $("#rs-pin").value.trim();
      if (!/^\d{4}$/.test(newPin))
        return toast(lang === "en" ? "PIN must be 4 digits" : "Le PIN doit faire 4 chiffres", "err");
      try {
        await NK.auth.resetPin({ shopId: sid, step: "set", phone, code, newPin });
        toast(lang === "en" ? "Code reset ✓ Please log in." : "Code réinitialisé ✓ Connectez-vous.");
        renderAuth("login");
      } catch (e) {
        toast(errMsg(e), "err");
      }
    };
  }

  // ========================================================================
  //  COQUILLE (barre du haut + navigation du bas)
  // ========================================================================
  const TAB_OF = {
    home: "home", sales: "sales", stock: "stock", inventory: "stock",
    reports: "reports", daily: "reports",
    more: "more", credits: "more", movements: "more", attendance: "more", cash: "more", team: "more", dead: "more",
  };

  function topActions() {
    return `<div class="tb-actions">
      ${outboxBadge()}
      ${langToggleHTML()}
      <button class="icon" data-act="sync" title="${t("sync")}">↻</button>
      <button class="icon" data-act="logout" title="${t("logout")}">⎋</button>
    </div>`;
  }

  function tabbarHTML() {
    const admin = NK.isAdmin();
    const active = TAB_OF[state.screen] || "home";
    const nav = [
      ["home", t("home"), "🏠"],
      ["sales", t("sales"), "🛒"],
      ["stock", t("stock"), "📦"],
      ["reports", t("reports"), "📊"],
      ["more", t("more"), "⋯"],
    ];
    return `<nav class="tabbar">
      ${nav
        .map(
          ([id, label, ic]) =>
            `<button class="tab ${active === id ? "active" : ""}" data-nav="${id}"><span>${ic}</span>${label}</button>`,
        )
        .join("")}
    </nav>`;
  }

  // Rendu générique : header + contenu + barre d'onglets, puis câblage commun.
  function paint(headerHTML, bodyHTML) {
    app.innerHTML = `${headerHTML}<main class="content">${bodyHTML}</main>${tabbarHTML()}`;
    $(".tabbar").onclick = (e) => {
      const b = e.target.closest("[data-nav]");
      if (b) go(b.dataset.nav);
    };
    const sync = $('[data-act="sync"]');
    if (sync) sync.onclick = () => refresh(true);
    document.querySelectorAll('[data-act="logout"]').forEach((lo) => {
      lo.onclick = async () => {
        await NK.auth.logout();
        renderAuth("login");
      };
    });
    const back = $("[data-back]");
    if (back) back.onclick = () => go(back.dataset.back);
    wireLang();
  }

  function wireLang() {
    document.querySelectorAll("[data-lang]").forEach((b) => {
      b.onclick = () => {
        if (b.dataset.lang === lang) return;
        setLang(b.dataset.lang);
        if (NK.isAuthed()) go(state.screen);
        else if (authView === "reset") renderReset();
        else renderAuth(authView);
      };
    });
  }

  // En-tête « sous-écran » : lien retour + gros titre.
  function subHeader(title, sub, backTo) {
    return `<header class="topbar sub">
        <button class="back" data-back="${backTo}">‹ ${esc(t(backTo))}</button>
        ${topActions()}
      </header>
      <div class="page-head"><h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ""}</div>`;
  }

  // En-tête « onglet principal » : titre simple.
  function tabHeader(title) {
    return `<header class="topbar">
        <span class="tb-title">${esc(title)}</span>
        ${topActions()}
      </header>`;
  }

  // ========================================================================
  //  ACCUEIL — dashboard héro
  // ========================================================================
  function screenHome() {
    const admin = NK.isAdmin();
    const ind = NK.indicators(state.products);
    const d = state.daily;
    const w = state.week;
    const owner = (NK.getUser() || {}).name || "";
    const alertN = ind.lowCount + ind.outCount;

    // Delta vs hier (à partir de l'agrégat hebdo).
    let deltaHTML = "";
    if (w && w.yestTotal != null) {
      const today = w.todayTotal || 0;
      const yest = w.yestTotal || 0;
      const pct = yest > 0 ? Math.round(((today - yest) / yest) * 100) : today > 0 ? 100 : 0;
      const up = today >= yest;
      deltaHTML = `<span class="hero-delta ${up ? "up" : "down"}">${up ? "↗" : "↘"} ${up ? "+" : ""}${pct}% ${t("vsYesterday")}</span>`;
    }

    const itemsSold = d && d.itemsSold ? d.itemsSold.reduce((a, i) => a + i.qty, 0) : null;
    const header = `<header class="topbar brand-bar">
        <div class="wordmark">${wordmarkHTML()}</div>
        ${topActions()}
      </header>`;

    const body = `
      <div class="greet">
        <h1>${t("hello")}, ${esc(owner)} 👋</h1>
        <p class="date">${dateLabel()}</p>
      </div>

      <div class="hero">
        <div class="hero-main">
          <span class="hero-k">${t("todaySales")}</span>
          <span class="hero-v">${d ? fmt(d.revenue) : "—"}</span>
          ${deltaHTML}
        </div>
        <div class="hero-stats">
          ${admin ? `<div><b>${d ? fmt(d.profit) : "—"}</b><span>${t("benefit")}</span></div>` : ""}
          <div><b>${d ? d.count : "—"}</b><span>${t("orders")}</span></div>
          <div><b>${itemsSold != null ? itemsSold : "—"}</b><span>${t("items")}</span></div>
        </div>
      </div>

      ${
        alertN
          ? `<button class="alert" data-nav="stock">
               <span class="alert-ic">!</span>
               <div class="alert-txt"><b>${t("watchStock")}</b><small>${alertN} ${t("itemsLow")}</small></div>
               <span class="alert-go">${t("seeStock")} →</span>
             </button>`
          : ""
      }

      <h3>${t("quickActions")}</h3>
      <div class="quick">
        <button class="q q-sale" data-nav="sales"><span class="q-ic">🛒</span>${t("newSale")}</button>
        <button class="q q-stock" data-nav="stock"><span class="q-ic">📦</span>${t("stock")}</button>
        <button class="q q-credit" data-nav="credits"><span class="q-ic">📕</span>${t("credits")}</button>
        <button class="q q-report" data-nav="reports"><span class="q-ic">📊</span>${t("reports")}</button>
      </div>

      <h3>${t("todayTitle")}</h3>
      <section class="cards">
        <div class="card"><span class="k">${t("articles")}</span><span class="v">${ind.skuCount}</span></div>
        <div class="card ${ind.lowCount ? "warn" : ""}"><span class="k">${t("lowStock")}</span><span class="v">${ind.lowCount}</span></div>
        <div class="card ${ind.outCount ? "danger" : ""}"><span class="k">${t("ruptures")}</span><span class="v">${ind.outCount}</span></div>
        <div class="card"><span class="k">${t("units")}</span><span class="v">${ind.units}</span></div>
      </section>
    `;

    paint(header, body);
    $(".content").onclick = (e) => {
      const b = e.target.closest("[data-nav]");
      if (b) go(b.dataset.nav);
    };
  }

  // ========================================================================
  //  VENTE
  // ========================================================================
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
      ["especes", t("espece")],
      ["wave", t("waveM")],
      ["om", t("omM")],
      ["card", t("cardM")],
      ["credit", t("creditM")],
    ];
    paint(
      tabHeader(t("newSale")),
      `
      <div class="search-row">
        <input id="q" class="search" placeholder="${t("search")}"/>
        <button class="scan-btn" id="scan" title="${t("scan")}">📷</button>
      </div>
      <div class="grid" id="prod-grid">
        ${state.products
          .map(
            (p) => `
          <button class="prod ${p.stock <= 0 ? "off" : ""}" data-add="${p.id}" ${p.stock <= 0 ? "disabled" : ""}>
            <span class="pn">${esc(pn(p))}</span>
            <span class="pp">${fmt(p.price)}</span>
            <span class="ps ${p.stock <= 0 ? "z" : p.stock <= p.threshold ? "low" : ""}">stock ${p.stock}</span>
          </button>`,
          )
          .join("")}
      </div>
      <div class="cart">
        <h3>${t("cart")} <span class="badge">${lines.length}</span></h3>
        ${
          lines.length
            ? lines
                .map(
                  ({ p, qty }) => `
          <div class="cl">
            <span>${esc(p ? pn(p) : "?")}</span>
            <div class="qty">
              <button data-dec="${p.id}">−</button><b>${qty}</b><button data-inc="${p.id}">+</button>
            </div>
            <span>${fmt(p ? p.price * qty : 0)}</span>
          </div>`,
                )
                .join("")
            : `<p class="muted">${t("cartEmpty")}</p>`
        }
        <div class="methods">${methods.map(([m, l]) => `<button class="m ${state.method === m ? "on" : ""}" data-m="${m}">${l}</button>`).join("")}</div>
        ${state.method === "credit" ? `<input id="cust" class="search" placeholder="${t("customerName")}" value="${esc(state.customer)}"/>` : ""}
        <button class="primary big" id="checkout" ${lines.length ? "" : "disabled"}>${t("checkout")} ${fmt(total)}</button>
      </div>`,
    );

    const grid = $("#prod-grid");
    $("#q").oninput = (e) => {
      const q = e.target.value.toLowerCase();
      grid.querySelectorAll(".prod").forEach((el) => {
        const p = state.products.find((x) => String(x.id) === el.dataset.add);
        el.style.display = p && pn(p).toLowerCase().includes(q) ? "" : "none";
      });
    };
    $(".content").onclick = (e) => {
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
  async function scan() {
    let code = null;
    if ("BarcodeDetector" in window && navigator.mediaDevices) {
      try {
        code = await scanCamera();
      } catch {
        /* repli saisie manuelle */
      }
    }
    if (!code) code = (prompt(t("scan") + " :") || "").trim();
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
    if (!p) return toast(lang === "en" ? "Unknown item for this code" : "Article inconnu pour ce code", "err");
    addToCart(p.id);
    toast(`+ ${pn(p)}`);
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
        close.textContent = lang === "en" ? "Close" : "Fermer";
        close.className = "primary";
        overlay.append(video, close);
        document.body.appendChild(overlay);
        let done = false;
        const stop = (val, err) => {
          if (done) return;
          done = true;
          stream.getTracks().forEach((tr) => tr.stop());
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
    if (stockOf(pid) <= 0) return toast(lang === "en" ? "Out of stock" : "Rupture de stock", "err");
    const cur = state.cart[pid] || 0;
    if (cur + 1 > stockOf(pid)) return toast(lang === "en" ? "Qty > stock" : "Quantité > stock", "err");
    state.cart[pid] = cur + 1;
    screenSales();
  }
  function incCart(pid, d) {
    const cur = state.cart[pid] || 0;
    const next = cur + d;
    if (next <= 0) delete state.cart[pid];
    else if (next > stockOf(pid)) return toast(lang === "en" ? "Qty > stock" : "Quantité > stock", "err");
    else state.cart[pid] = next;
    screenSales();
  }

  async function checkout() {
    const lines = cartLines();
    if (!lines.length) return;
    if (state.method === "credit" && !state.customer.trim())
      return toast(lang === "en" ? "Enter the customer name" : "Indique le nom du client", "err");
    const payload = lines.map(({ p, qty }) => ({ productId: p.id, qty }));
    lines.forEach(({ p, qty }) => (p.stock = Math.max(0, p.stock - qty)));
    const cust = state.customer.trim();
    state.cart = {};
    state.customer = "";
    const m = state.method;
    state.method = "especes";
    try {
      await NK.ops.finalizeSale(payload, m, cust || null);
      if (NK.outbox.count() > 0) toast(lang === "en" ? "Sale queued (offline) ⌛" : "Vente en file (hors ligne) ⌛");
      else
        toast(
          m === "credit"
            ? lang === "en"
              ? "Credit sale recorded ✓"
              : "Vente à crédit enregistrée ✓"
            : lang === "en"
              ? "Sale recorded ✓"
              : "Vente enregistrée ✓",
        );
    } catch (e) {
      toast(errMsg(e), "err");
    }
    await refresh(false);
    screenSales();
  }

  // ========================================================================
  //  STOCK
  // ========================================================================
  function screenStock() {
    const admin = NK.isAdmin();
    paint(
      tabHeader(t("stock")),
      `
      <div class="stock-actions">
        <button id="inv-btn">📋 ${t("inventory")}</button>
        ${admin ? `<button id="add-prod-btn">＋ ${t("product")}</button>` : ""}
      </div>
      <input id="q" class="search" placeholder="${t("search")}"/>
      <div class="list" id="stock-list">
        ${state.products
          .map(
            (p) => `
          <div class="row" data-p="${p.id}">
            <div class="row-main">
              <strong>${esc(pn(p))}</strong>
              <small>${esc(p.category)}${admin && p.cost != null ? ` · ${lang === "en" ? "cost" : "coût"} ${fmt(p.cost)}` : ""} · ${fmt(p.price)}</small>
            </div>
            <span class="pill ${p.stock === 0 ? "z" : p.stock <= p.threshold ? "low" : "ok"}">${p.stock}</span>
            <div class="row-act">
              <button data-restock="${p.id}">+ ${t("restock")}</button>
              <button data-adjust="${p.id}">± ${t("adjust")}</button>
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
          el.style.display = p && pn(p).toLowerCase().includes(q) ? "" : "none";
        });
    };
    $("#stock-list").onclick = async (e) => {
      const rs = e.target.closest("[data-restock]");
      const aj = e.target.closest("[data-adjust]");
      if (rs) {
        const qty = +prompt(lang === "en" ? "Quantity received?" : "Quantité reçue ?");
        if (!qty || qty <= 0) return;
        const nc = admin ? prompt(lang === "en" ? "New unit cost? (blank = unchanged)" : "Nouveau coût unitaire ? (vide = inchangé)") : "";
        await NK.ops.restock(rs.dataset.restock, qty, nc ? +nc : null);
        toast(lang === "en" ? "Restock recorded ✓" : "Réassort enregistré ✓");
        refresh(false);
      } else if (aj) {
        const d = +prompt(lang === "en" ? "Adjustment (+/−)?" : "Ajustement (+/−) ?");
        if (!d) return;
        await NK.ops.adjust(aj.dataset.adjust, d);
        toast(lang === "en" ? "Adjustment recorded ✓" : "Ajustement enregistré ✓");
        refresh(false);
      }
    };
    $("#inv-btn").onclick = () => go("inventory");
    const addBtn = $("#add-prod-btn");
    if (addBtn) addBtn.onclick = addProductModal;
  }

  function screenInventory() {
    paint(
      subHeader(t("inventory"), null, "stock"),
      `
      <p class="muted">${t("inventoryHint")}</p>
      <div class="list">
        ${state.products
          .map(
            (p) => `
          <div class="row">
            <div class="row-main"><strong>${esc(pn(p))}</strong><small>${t("theoretical")} : ${p.stock}</small></div>
            <input class="count" type="number" min="0" inputmode="numeric" data-c="${p.id}" value="${p.stock}" />
          </div>`,
          )
          .join("")}
      </div>
      <button class="primary big" id="inv-save">${t("validate")}</button>
      <button class="link" id="inv-cancel">${t("cancel")}</button>`,
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
      if (!counts.length) return toast(lang === "en" ? "No difference to record" : "Aucun écart à enregistrer");
      await NK.ops.inventory(counts);
      toast(`${counts.length} ${lang === "en" ? "difference(s) recorded ✓" : "écart(s) enregistré(s) ✓"}`);
      await refresh(false);
      go("stock");
    };
  }

  function addProductModal() {
    const body = `
      <h3>${lang === "en" ? "New product" : "Nouveau produit"}</h3>
      <div class="form">
        <input id="f-fr" placeholder="${lang === "en" ? "Name (French)" : "Nom (français)"}"/>
        <input id="f-en" placeholder="${lang === "en" ? "Name (English)" : "Nom (anglais)"}"/>
        <select id="f-cat"><option value="vetements">${lang === "en" ? "Clothing" : "Vêtements"}</option><option value="cosmetiques">${lang === "en" ? "Cosmetics" : "Cosmétiques"}</option></select>
        <div class="two"><input id="f-price" type="number" placeholder="${lang === "en" ? "Sale price" : "Prix de vente"}"/><input id="f-cost" type="number" placeholder="${lang === "en" ? "Cost" : "Coût d'achat"}"/></div>
        <div class="two"><input id="f-stock" type="number" placeholder="${lang === "en" ? "Initial stock" : "Stock initial"}" value="0"/><input id="f-thr" type="number" placeholder="${lang === "en" ? "Alert threshold" : "Seuil alerte"}" value="4"/></div>
        <input id="f-sup" placeholder="${lang === "en" ? "Supplier (optional)" : "Fournisseur (optionnel)"}"/>
        <input id="f-code" placeholder="${lang === "en" ? "Barcode (blank = generated)" : "Code-barres (vide = généré)"}"/>
      </div>`;
    modal(body, async () => {
      const fr = $("#f-fr").value.trim();
      const en = $("#f-en").value.trim() || fr;
      if (!fr) {
        toast(lang === "en" ? "Name required" : "Nom requis", "err");
        return false;
      }
      let code = $("#f-code").value.trim();
      if (code && !NKBarcode.isValid(code)) {
        toast(lang === "en" ? "Invalid EAN-13 barcode" : "Code-barres EAN-13 invalide", "err");
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
        toast(lang === "en" ? "Product added ✓" : "Produit ajouté ✓");
        await refresh(false);
        go("stock");
        return true;
      } catch (e) {
        toast(errMsg(e), "err");
        return false;
      }
    });
  }

  function modal(bodyHTML, onOk) {
    const m = document.createElement("div");
    m.className = "modal-back";
    m.innerHTML = `<div class="modal">${bodyHTML}<div class="modal-actions"><button class="link" data-x>${t("cancel")}</button><button class="primary" data-ok>${t("validate")}</button></div></div>`;
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

  // ========================================================================
  //  CRÉDITS
  // ========================================================================
  async function screenCredits() {
    let credits = [];
    try {
      credits = await NK.reads.credits("open");
    } catch {
      /* offline */
    }
    paint(
      subHeader(t("credits"), null, "more"),
      `
      <div class="list">
        ${
          credits.length
            ? credits
                .map(
                  (c) => `
          <div class="row">
            <div class="row-main"><strong>${esc(c.customer_name)}</strong><small>${new Date(c.created_at).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR")}</small></div>
            <span class="pill low">${fmt(c.amount)}</span>
            <div class="row-act"><button class="primary" data-pay="${c.id}">${t("markPaid")}</button></div>
          </div>`,
                )
                .join("")
            : `<p class="muted">${t("noCredits")}</p>`
        }
      </div>`,
    );
    $(".content").onclick = async (e) => {
      const pay = e.target.closest("[data-pay]");
      if (!pay) return;
      if (!confirm(lang === "en" ? "Confirm payment (credit the till)?" : "Confirmer le paiement (créditer la caisse) ?")) return;
      try {
        await NK.ops.payCredit(pay.dataset.pay);
        toast(lang === "en" ? "Credit settled ✓" : "Crédit soldé ✓");
        screenCredits();
      } catch (er) {
        toast(errMsg(er), "err");
      }
    };
  }

  // ========================================================================
  //  RAPPORTS (aperçu + graphe hebdo) → détail via Fiche du jour
  // ========================================================================
  function weekChartHTML(w) {
    if (!w || !w.days || !w.days.length) return `<p class="muted">${t("noData")}</p>`;
    const max = Math.max(1, ...w.days.map((d) => d.total));
    const bars = w.days
      .map((d, i) => {
        const h = Math.max(6, Math.round((d.total / max) * 92));
        return `<div class="wk-col ${i === w.bestIdx ? "best" : ""}"><div class="wk-bar" style="height:${h}px"></div><span class="wk-lb">${esc(d.label)}</span></div>`;
      })
      .join("");
    return `<div class="week-card">
      <div class="week-head">
        <div><span class="wk-k">${t("weekCA")}</span><span class="wk-v">${fmt(w.sum)}</span></div>
        <div class="wk-best"><span class="wk-k">${t("bestDay")}</span><span class="wk-b">${esc(w.days[w.bestIdx] ? w.days[w.bestIdx].label : "—")}</span></div>
      </div>
      <div class="week-chart">${bars}</div>
    </div>`;
  }

  function screenReports() {
    const admin = NK.isAdmin();
    const d = state.daily;
    const body = `
      <button class="fiche-card" data-nav="daily">
        <span class="fiche-ic">📄</span>
        <div class="fiche-txt"><b>${t("ficheJour")}</b><small>${t("ficheSub")}</small></div>
        <span class="fiche-go">›</span>
      </button>
      <section class="cards">
        <div class="card big"><span class="k">${t("revenue")}</span><span class="v green">${d ? fmt(d.revenue) : "—"}</span></div>
        ${admin ? `<div class="card big"><span class="k">${t("benefit")}</span><span class="v green">${d ? fmt(d.profit) : "—"}</span></div>` : ""}
      </section>
      <div class="card wide"><span class="k">${t("salesCount")}</span><span class="v">${d ? d.count : "—"}</span></div>
      ${admin ? `<h3>${t("week")}</h3>${weekChartHTML(state.week)}` : ""}
    `;
    paint(tabHeader(t("reports")), body);
    $(".content").onclick = (e) => {
      const b = e.target.closest("[data-nav]");
      if (b) go(b.dataset.nav);
    };
  }

  async function screenDaily() {
    let d = state.daily;
    try {
      d = await NK.reads.dailySheet(today(), tz());
      state.daily = d;
    } catch {
      /* offline : garde l'état */
    }
    const admin = NK.isAdmin();
    paint(
      subHeader(t("ficheJour"), dateLabel(), "reports"),
      d
        ? `
      <div class="stock-actions">
        <button id="exp-csv">⬇ ${t("exportCsv")}</button>
        <button id="exp-pdf">🖨 ${t("exportPdf")}</button>
      </div>
      <section class="cards">
        <div class="card big"><span class="k">${t("revenue")}</span><span class="v">${fmt(d.revenue)}</span></div>
        <div class="card big"><span class="k">${t("salesCount")}</span><span class="v">${d.count}</span></div>
        ${admin ? `<div class="card big"><span class="k">${t("benefit")}</span><span class="v">${fmt(d.profit)}</span></div>` : ""}
        <div class="card big"><span class="k">${t("credits")}</span><span class="v">${fmt(d.creditsGiven)}</span></div>
      </section>
      <h3>${t("byPayment")}</h3>
      <div class="list">${(d.byPayment || []).map((b) => `<div class="row"><div class="row-main"><strong>${esc(b.method)}</strong></div><span>${fmt(b.amount)}</span></div>`).join("") || `<p class="muted">${t("noData")}</p>`}</div>
      <h3>${t("itemsSold")}</h3>
      <div class="list">${(d.itemsSold || []).map((i) => `<div class="row"><div class="row-main"><strong>${esc(i.name)}</strong></div><span>×${i.qty}</span><span>${fmt(i.amount)}</span></div>`).join("") || `<p class="muted">${t("noData")}</p>`}</div>
      <h3>${t("operations")}</h3>
      <div class="list">${(d.operations || []).map((o) => `<div class="row"><div class="row-main"><strong>${esc(o.time)}</strong><small>${esc(o.label)}</small></div><span>${esc(o.method)}</span><span>${fmt(o.amount)}</span></div>`).join("") || `<p class="muted">${t("noData")}</p>`}</div>`
        : `<p class="muted">${t("offlineData")}</p>`,
    );
    if (d) {
      const shopName = (NK.getShop() || {}).name || "NATHAN KIDS";
      $("#exp-csv").onclick = () => NKExport.csv(d, admin);
      $("#exp-pdf").onclick = () => {
        if (!NKExport.printPDF(d, admin, shopName)) toast(lang === "en" ? "Allow pop-ups for the PDF" : "Autorisez les fenêtres pop-up pour le PDF", "err");
      };
    }
  }

  // ========================================================================
  //  PLUS (hub des écrans secondaires)
  // ========================================================================
  function screenMore() {
    const admin = NK.isAdmin();
    const u = NK.getUser() || {};
    const roleLabel = admin ? t("roleAdminF") : t("roleStaffF");
    const tiles = [
      ["movements", "🔄", t("movements"), t("movementsSub"), "t-move"],
      ["inventory", "📋", t("inventoryTile"), t("inventoryHintShort"), "t-inv"],
      ["dead", "🕰️", t("deadStock"), t("deadStockSub"), "t-dead"],
      ["credits", "📕", t("credits"), lang === "en" ? "Who owes money" : "Qui doit de l'argent", "t-credit"],
    ];
    if (admin) {
      tiles.push(["attendance", "⏱️", t("attendance"), t("attendanceSub"), "t-att"]);
      tiles.push(["cash", "💰", t("cash"), t("cashSub"), "t-cash"]);
      tiles.push(["team", "👥", t("team"), t("teamSub"), "t-team"]);
    }
    paint(
      tabHeader(t("more")),
      `<div class="profile">
         <div class="avatar lg">${esc(initials(u.name))}</div>
         <div class="profile-main"><strong>${esc(u.name || "")}</strong><small>${esc(roleLabel)}${(NK.getShop() || {}).name ? " · " + esc(NK.getShop().name) : ""}</small></div>
         <button class="logout-btn" data-act="logout">${t("disconnect")}</button>
       </div>
       <h3>${t("gestion")} <span class="h3-sub">· ${t("gestionSub")}</span></h3>
       <div class="tiles">
        ${tiles
          .map(
            ([id, ic, label, sub, cls]) => `
          <button class="tile ${cls}" data-nav="${id}">
            <span class="tile-ic">${ic}</span>
            <span class="tile-l">${esc(label)}</span>
            <span class="tile-s">${esc(sub)}</span>
          </button>`,
          )
          .join("")}
      </div>`,
    );
    $(".content").onclick = (e) => {
      const b = e.target.closest("[data-nav]");
      if (b) go(b.dataset.nav);
    };
  }

  // ========================================================================
  //  STOCK MORT (articles avec du stock mais sans vente récente)
  // ========================================================================
  async function screenDeadStock() {
    const admin = NK.isAdmin();
    const days = state.deadDays || 60;
    let times = [];
    try {
      times = await NK.reads.saleTimes(1000);
    } catch {
      times = [];
    }
    // 1re occurrence d'un produit (ordre décroissant) = sa dernière vente.
    const last = {};
    times.forEach((r) => {
      if (r.product_id && !last[r.product_id]) last[r.product_id] = r.created_at;
    });
    const now = Date.now();
    const dead = state.products
      .filter((p) => p.stock > 0)
      .map((p) => {
        const ls = last[p.id] || null;
        const daysSince = ls ? Math.floor((now - new Date(ls).getTime()) / 86400000) : null;
        return { p, ls, daysSince };
      })
      .filter((d) => d.daysSince === null || d.daysSince >= days)
      .sort((a, b) => (b.daysSince === null ? 1e9 : b.daysSince) - (a.daysSince === null ? 1e9 : a.daysSince));

    const retailVal = dead.reduce((a, d) => a + d.p.price * d.p.stock, 0);
    const costVal = dead.reduce((a, d) => a + (d.p.cost || 0) * d.p.stock, 0);
    const chips = [30, 60, 90]
      .map((n) => `<button class="chip ${n === days ? "on" : ""}" data-days="${n}">${n} j</button>`)
      .join("");

    const list = dead.length
      ? dead
          .map(
            ({ p, daysSince }) => `
        <div class="row">
          <div class="row-main">
            <strong>${esc(pn(p))}</strong>
            <small>${daysSince === null ? t("neverSold") : `${daysSince} ${t("noSaleSince")}`} · ${fmt(p.price * p.stock)}${admin && p.cost != null ? ` · ${lang === "en" ? "cost" : "coût"} ${fmt(p.cost * p.stock)}` : ""}</small>
          </div>
          <span class="pill z">${p.stock}</span>
        </div>`,
          )
          .join("")
      : `<p class="muted">${t("noDeadStock")}</p>`;

    paint(
      subHeader(t("deadStock"), t("deadStockSub"), "more"),
      `<div class="chips">${t("sinceLabel")} : ${chips}</div>
       ${
         dead.length
           ? `<div class="dead-summary">
                <div><span class="ds-v">${dead.length}</span><span class="ds-k">${t("deadCount")}</span></div>
                <div><span class="ds-v">${fmt(retailVal)}</span><span class="ds-k">${t("immobilizedRetail")}${admin ? ` · ${fmt(costVal)} ${t("immobilizedCost")}` : ""}</span></div>
              </div>`
           : ""
       }
       <div class="list">${list}</div>`,
    );
    $(".chips").onclick = (e) => {
      const b = e.target.closest("[data-days]");
      if (!b) return;
      state.deadDays = +b.dataset.days;
      screenDeadStock();
    };
  }

  // ========================================================================
  //  POINTAGE VENDEUSES
  // ========================================================================
  async function screenAttendance() {
    if (!NK.isAdmin()) return go("more");
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    let rows = null;
    try {
      rows = await NK.reads.attendance(from.toISOString());
    } catch {
      rows = (NK.cache.read().attendance || []).map((a) => ({
        id: a.id,
        login_at: a.loginAt,
        logout_at: a.logoutAt,
        active: a.active,
        users: { name: a.name },
      }));
    }
    rows = rows || [];
    const list = rows.length
      ? rows
          .map((a) => {
            const name = (a.users && a.users.name) || a.name || "?";
            const ongoing = !a.logout_at && a.active;
            const dur = durLabel(a.login_at, a.logout_at);
            return `
        <div class="att-row">
          <div class="avatar">${esc(initials(name))}</div>
          <div class="att-main">
            <strong>${esc(name)} <span class="role-mini">${esc(t("seller"))}</span></strong>
            <div class="att-times">
              <span class="at-in"><small>${t("arrival")}</small>${hhmm(a.login_at)}</span>
              <span class="at-out"><small>${t("departure")}</small>${a.logout_at ? hhmm(a.logout_at) : "—"}</span>
            </div>
          </div>
          <span class="dur ${ongoing ? "live" : ""}">${ongoing ? t("ongoing") : dur}</span>
        </div>`;
          })
          .join("")
      : `<p class="muted">${lang === "en" ? "No clock-in today." : "Aucun pointage aujourd'hui."}</p>`;
    paint(subHeader(t("attendance"), t("attendanceSub"), "more"), `<div class="att-list">${list}</div>`);
  }

  // ========================================================================
  //  MOUVEMENTS DE STOCK
  // ========================================================================
  async function screenMovements() {
    let rows = null;
    try {
      rows = await NK.reads.movements(60);
    } catch {
      rows = (NK.cache.read().stockMovements || []).map((m) => ({
        id: m.id,
        product_name: m.productName,
        direction: m.direction,
        qty: m.qty,
        reason: m.reason,
        created_at: m.createdAt,
      }));
    }
    rows = rows || [];
    const reasonLabel = { sale: t("reasonSale"), restock: t("reasonRestock"), adjust: t("reasonAdjust"), inv: t("reasonInv") };
    let inSum = 0,
      outSum = 0;
    rows.forEach((m) => (m.direction === "in" ? (inSum += m.qty) : (outSum += m.qty)));
    const list = rows.length
      ? rows
          .map((m) => {
            const isIn = m.direction === "in";
            return `
        <div class="mv-row">
          <span class="mv-badge ${isIn ? "in" : "out"}">${isIn ? "+" : "−"}${m.qty}</span>
          <div class="mv-main">
            <strong>${esc(m.product_name)}</strong>
            <small>${esc(reasonLabel[m.reason] || m.reason)} · ${hhmm(m.created_at)}</small>
          </div>
        </div>`;
          })
          .join("")
      : `<p class="muted">${lang === "en" ? "No movement." : "Aucun mouvement."}</p>`;
    paint(
      subHeader(t("movements"), t("movementsSub"), "more"),
      `<div class="mv-summary">
         <div class="mv-sum in"><span class="mv-sum-k">${t("entries")}</span><span class="mv-sum-v">+${inSum}</span></div>
         <div class="mv-sum out"><span class="mv-sum-k">${t("exits")}</span><span class="mv-sum-v">−${outSum}</span></div>
       </div>
       <div class="mv-list">${list}</div>`,
    );
  }

  // ========================================================================
  //  CAISSE & BANQUE
  // ========================================================================
  async function screenCash() {
    if (!NK.isAdmin()) return go("more");
    let acc = { cash: 0, bank: 0 };
    try {
      const rows = await NK.reads.accounts();
      rows.forEach((r) => (acc[r.kind] = r.balance));
    } catch {
      /* offline */
    }
    paint(
      subHeader(t("cash"), t("cashSub"), "more"),
      `
      <section class="cards">
        <div class="card big cash-box"><span class="k">${t("cashBox")}</span><span class="v">${fmt(acc.cash)}</span></div>
        <div class="card big bank-box"><span class="k">${t("bank")}</span><span class="v">${fmt(acc.bank)}</span></div>
      </section>
      <div class="money-actions">
        <button data-mv="deposit">➕ ${t("deposit")}</button>
        <button data-mv="withdraw">➖ ${t("withdraw")}</button>
        <button data-mv="toBank">🏦 ${t("toBank")}</button>
      </div>`,
    );
    $(".money-actions").onclick = async (e) => {
      const b = e.target.closest("[data-mv]");
      if (!b) return;
      const type = b.dataset.mv;
      const amount = +prompt(lang === "en" ? "Amount (FCFA)?" : "Montant (FCFA) ?");
      if (!amount || amount <= 0) return;
      let target = "cash";
      if (type !== "toBank")
        target = confirm(lang === "en" ? "OK = Cash, Cancel = Bank" : "OK = Caisse, Annuler = Banque") ? "cash" : "bank";
      try {
        await NK.ops.moneyMove(type, target, amount);
        toast(lang === "en" ? "Movement recorded ✓" : "Mouvement enregistré ✓");
        screenCash();
      } catch (er) {
        toast(errMsg(er), "err");
      }
    };
  }

  // ========================================================================
  //  ÉQUIPE (gestion des vendeuses)
  // ========================================================================
  async function screenTeam() {
    if (!NK.isAdmin()) return go("more");
    paint(
      subHeader(t("team"), t("teamSub"), "more"),
      `<div class="list" id="staff-list"></div>
       <button class="primary big" id="add-staff">＋ ${t("addSeller")}</button>`,
    );
    try {
      const staff = (await NK.reads.staff()).filter((u) => u.role === "staff" && u.active);
      $("#staff-list").innerHTML =
        staff
          .map(
            (s) =>
              `<div class="row"><div class="avatar sm">${esc(initials(s.name))}</div><div class="row-main"><strong>${esc(s.name)}</strong></div><button data-del="${s.id}">${t("remove")}</button></div>`,
          )
          .join("") || `<p class="muted">${t("noSeller")}</p>`;
      $("#staff-list").onclick = async (e) => {
        const d = e.target.closest("[data-del]");
        if (d && confirm(lang === "en" ? "Deactivate this seller?" : "Désactiver cette vendeuse ?")) {
          await NK.ops.removeStaff(d.dataset.del);
          toast(lang === "en" ? "Seller deactivated" : "Vendeuse désactivée");
          screenTeam();
        }
      };
    } catch {
      /* offline */
    }
    $("#add-staff").onclick = async () => {
      const name = prompt(lang === "en" ? "Seller name?" : "Nom de la vendeuse ?");
      if (!name) return;
      const pin = prompt(lang === "en" ? "PIN code (4 digits)?" : "Code PIN (4 chiffres) ?");
      if (!/^\d{4}$/.test(pin || "")) return toast(lang === "en" ? "Invalid PIN" : "PIN invalide", "err");
      try {
        await NK.ops.addStaff(name, pin);
        toast(lang === "en" ? "Seller added ✓" : "Vendeuse ajoutée ✓");
        screenTeam();
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
    reports: screenReports,
    daily: screenDaily,
    more: screenMore,
    movements: screenMovements,
    attendance: screenAttendance,
    cash: screenCash,
    team: screenTeam,
    dead: screenDeadStock,
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

  // ---- Agrégat hebdomadaire (7 derniers jours, fuseau local) ----------------
  function weekFromISO() {
    const s = new Date();
    s.setHours(0, 0, 0, 0);
    s.setDate(s.getDate() - 6);
    return s.toISOString();
  }
  const localKey = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  function aggWeek(rows) {
    const days = [];
    const idx = {};
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    for (let i = 6; i >= 0; i--) {
      const dd = new Date(base);
      dd.setDate(base.getDate() - i);
      const key = localKey(dd);
      const label = cap(dd.toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR", { weekday: "short" }));
      idx[key] = days.length;
      days.push({ key, label, total: 0 });
    }
    (rows || []).forEach((r) => {
      const bucket = idx[localKey(new Date(r.created_at))];
      if (bucket != null) days[bucket].total += r.total || 0;
    });
    let bestIdx = 0;
    days.forEach((d, i) => {
      if (d.total > days[bestIdx].total) bestIdx = i;
    });
    const sum = days.reduce((a, d) => a + d.total, 0);
    return { days, sum, bestIdx, todayTotal: days[6].total, yestTotal: days[5] ? days[5].total : 0 };
  }

  // Charge fiche du jour + hebdo (utilisés par Accueil et Rapports).
  async function loadStats() {
    try {
      state.daily = await NK.reads.dailySheet(today(), tz());
    } catch {
      /* garde l'ancien état */
    }
    try {
      state.week = aggWeek(await NK.reads.weekSales(weekFromISO()));
    } catch {
      /* garde l'ancien état */
    }
  }

  // ---- Rafraîchissement (sync + cache + stats) ------------------------------
  async function refresh(rerender) {
    try {
      await NK.outbox.flush();
      const data = await NK.reads.sync();
      if (data.products) state.products = data.products;
    } catch {
      const c = NK.cache.read();
      if (c.products) state.products = c.products;
    }
    await loadStats();
    if (rerender !== false) go(state.screen);
  }

  async function boot() {
    if (!NK.isAuthed()) return renderAuth(NK.getShop() ? "login" : "signup");
    const c = NK.cache.read();
    state.products = c.products || [];
    go("home");
    await refresh(true);
  }

  window.addEventListener("online", () => refresh(false));
  boot();
})();
