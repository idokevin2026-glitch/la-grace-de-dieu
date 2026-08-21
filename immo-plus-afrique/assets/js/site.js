/* ==========================================================
   IMMO+ Afrique
   Aucune bibliothèque. Une seule boucle d'animation, qui se met
   au repos dès qu'il n'y a plus rien à bouger.
   ========================================================== */
(() => {
  'use strict';

  const WA_NUM = '2250700000000';           // numéro d'exemple, à remplacer
  const VIDEO_SRC = 'assets/video/hero-scrub.mp4';

  const doc = document;
  const html = doc.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = matchMedia('(max-width: 900px), (pointer: coarse)');

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const ramp = (v, a, b) => clamp((v - a) / (b - a), 0, 1);
  const smooth = t => t * t * (3 - 2 * t);
  const $ = (s, r) => (r || doc).querySelector(s);
  const $$ = (s, r) => Array.from((r || doc).querySelectorAll(s));

  // déclarés tôt : ils sont lus par des fonctions appelées dès le démarrage
  const nf = new Intl.NumberFormat('fr-FR');
  let drawerOpen = false;

  /* ---------- liens WhatsApp ---------- */
  const waLink = (msg) =>
    'https://wa.me/' + WA_NUM + '?text=' + encodeURIComponent(msg);

  $$('[data-wa]').forEach(a => {
    a.href = waLink(a.dataset.wa);
    a.target = '_blank';
    a.rel = 'noopener';
  });

  $('#year').textContent = String(new Date().getFullYear());

  /* ==========================================================
     1. Le héros
     ========================================================== */
  const hero    = $('#hero');
  const stage   = $('.hero__stage');
  const scene   = $('#scene');
  const video   = $('#heroVideo');
  const loader  = $('#heroLoader');
  const ring    = $('#ring');
  const bands   = $$('.band');
  const settle  = $('#settle');
  const hint    = $('#hint');
  const layers  = $$('.scene .lay').map(el => ({
    el, depth: parseFloat(el.dataset.depth) || 0, last: ''
  }));
  const windows = $('.scene .windows');
  const dustCv  = $('#dust');

  let heroProgress = 0;      // cible, 0 à 1
  let shown = 0;             // valeur adoucie réellement affichée
  let heroSpan = 1;
  let videoReady = false;
  let seeking = false;
  let lastSeek = -1;
  let lastBandState = -1;
  let settleOn = false;

  function measure() {
    heroSpan = Math.max(1, hero.offsetHeight - window.innerHeight);
    if (dustCv) {
      const r = dustCv.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      dustCv.width = Math.max(1, Math.round(r.width * dpr));
      dustCv.height = Math.max(1, Math.round(r.height * dpr));
    }
  }

  function readProgress() {
    const top = hero.getBoundingClientRect().top;
    heroProgress = clamp(-top / heroSpan, 0, 1);
  }

  /* --- la vidéo, si le fichier existe un jour --- */
  async function tryVideo() {
    if (reduce.matches || coarse.matches) return;
    let res;
    try {
      res = await fetch(VIDEO_SRC, { cache: 'force-cache' });
    } catch (e) { return; }                       // file:// ou fichier absent
    if (!res.ok || !res.body) return;

    const total = Number(res.headers.get('content-length') || 0);
    const big = total > 1_500_000;
    if (big && ring) { loader.hidden = false; }

    const chunks = [];
    let got = 0;
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      got += value.length;
      if (big && total && ring) {
        ring.style.strokeDashoffset = String(107 * (1 - got / total));
      }
    }
    const blob = new Blob(chunks, { type: 'video/mp4' });
    video.src = URL.createObjectURL(blob);
    await new Promise(r => {
      if (video.readyState >= 1) return r();
      video.addEventListener('loadedmetadata', r, { once: true });
    });
    loader.hidden = true;
    videoReady = true;
    hero.classList.add('has-video');
    video.addEventListener('seeking', () => { seeking = true; });
    video.addEventListener('seeked',  () => { seeking = false; });
    kick();
  }

  /* --- le héros dessiné, quand il n'y a pas de vidéo --- */
  function paintScene(p) {
    for (const L of layers) {
      const ty = (p * L.depth * 190).toFixed(2);
      const sc = (1 + p * L.depth * 0.42).toFixed(4);
      const t = 'translateY(' + ty + 'px) scale(' + sc + ')';
      if (t !== L.last) { L.el.style.transform = t; L.last = t; }
    }
    if (windows) {
      const o = (smooth(ramp(p, 0.34, 0.86)) * 0.9).toFixed(3);
      if (windows.style.opacity !== o) windows.style.opacity = o;
    }
  }

  /* --- les bandes de texte --- */
  function paintBands(p) {
    let state = 0;
    bands.forEach((b, i) => {
      const a = parseFloat(b.dataset.in), z = parseFloat(b.dataset.out);
      const inn = smooth(ramp(p, a, a + 0.06));
      const out = 1 - smooth(ramp(p, z - 0.06, z));
      const o = Math.min(inn, out);
      if (o > 0.02) state = i + 1;
      const y = (1 - inn) * 34 + (1 - out) * -22;
      b.style.opacity = o.toFixed(3);
      b.style.transform = 'translateY(' + y.toFixed(1) + 'px)';
    });
    if (state !== lastBandState) lastBandState = state;

    const on = p > 0.78;
    if (on !== settleOn) {
      settleOn = on;
      settle.classList.toggle('is-on', on);
    }
    if (hint) hint.classList.toggle('is-off', p > 0.04);
  }

  /* --- la poussière d'harmattan --- */
  const dust = (() => {
    if (!dustCv) return null;
    const ctx = dustCv.getContext('2d', { alpha: true });
    let bits = [];
    function seed() {
      const n = coarse.matches ? 26 : 46;
      bits = Array.from({ length: n }, () => ({
        x: Math.random(), y: Math.random(),
        r: 0.6 + Math.random() * 1.9,
        s: 0.00008 + Math.random() * 0.00022,
        a: 0.12 + Math.random() * 0.4,
        w: Math.random() * 6.28
      }));
    }
    seed();
    return {
      draw(t) {
        const W = dustCv.width, H = dustCv.height;
        ctx.clearRect(0, 0, W, H);
        for (const b of bits) {
          b.y -= b.s;
          if (b.y < -0.02) { b.y = 1.02; b.x = Math.random(); }
          const x = (b.x + Math.sin(t * 0.0004 + b.w) * 0.012) * W;
          const y = b.y * H;
          ctx.globalAlpha = b.a;
          ctx.fillStyle = '#F6CF86';
          ctx.beginPath();
          ctx.arc(x, y, b.r * (devicePixelRatio > 1 ? 1.6 : 1), 0, 6.283);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      },
      seed
    };
  })();

  /* ==========================================================
     2. Une seule boucle, qui sait s'arrêter
     ========================================================== */
  let running = false, idle = 0, heroVisible = true;

  function frame(t) {
    let work = false;

    if (heroVisible) {
      shown = lerp(shown, heroProgress, 0.12);
      if (Math.abs(shown - heroProgress) < 0.0004) shown = heroProgress;
      else work = true;

      if (videoReady) {
        const d = video.duration || 1;
        const target = shown * d * 0.999;
        if (!seeking && Math.abs(target - lastSeek) > 0.016) {
          lastSeek = target;
          try { video.currentTime = target; } catch (e) { /* ignoré */ }
        }
      } else {
        paintScene(shown);
      }
      paintBands(shown);

      if (dust && !reduce.matches) { dust.draw(t); work = true; }
    }

    idle = work ? 0 : idle + 1;
    if (idle > 30) { running = false; return; }
    requestAnimationFrame(frame);
  }

  // point de passage unique : en mouvement réduit la boucle ne démarre jamais,
  // sinon elle réécrit l'opacité des phrases posées à la main au chargement
  function kick() {
    if (reduce.matches) return;
    idle = 0;
    if (!running) { running = true; requestAnimationFrame(frame); }
  }

  /* ==========================================================
     3. Écoute du défilement
     ========================================================== */
  const nav = $('#nav');
  let lastY = window.scrollY;

  function onScroll() {
    const y = window.scrollY;
    readProgress();

    nav.classList.toggle('is-stuck', y > 24);
    const down = y > lastY;
    nav.classList.toggle('is-hidden', down && y > window.innerHeight * 0.9 && !drawerOpen);
    lastY = y;

    kick();
  }

  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => { measure(); readProgress(); dust && dust.seed(); kick(); });
  addEventListener('orientationchange', () => setTimeout(() => { measure(); kick(); }, 260));

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(es => {
      heroVisible = es[0].isIntersecting;
      if (heroVisible) kick();
    }, { rootMargin: '10% 0px' }).observe(stage);
  }

  /* ==========================================================
     4. Révélations au défilement
     ========================================================== */
  $$('.dr').forEach(p => {
    try {
      // seule la longueur est posée ici : la feuille de style
      // garde la main sur le tracé, sinon la révélation ne part jamais
      p.style.setProperty('--len', Math.ceil(p.getTotalLength()));
    } catch (e) { /* pas de longueur mesurable */ }
  });

  if ('IntersectionObserver' in window && !reduce.matches) {
    const io = new IntersectionObserver((es, o) => {
      es.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        countUp(e.target);
        o.unobserve(e.target);
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });
    $$('.rv').forEach(el => io.observe(el));
  } else {
    $$('.rv').forEach(el => { el.classList.add('is-in'); countUp(el); });
  }

  /* ---------- compteurs ---------- */
  function countUp(root) {
    $$('.count', root).forEach(el => {
      if (el.dataset.done) return;
      el.dataset.done = '1';
      const to = Number(el.dataset.to || 0);
      const sep = el.dataset.sep === '1';
      if (reduce.matches) { el.textContent = sep ? nf.format(to) : String(to); return; }
      const dur = 1500, t0 = performance.now();
      (function tick(t) {
        const k = clamp((t - t0) / dur, 0, 1);
        const v = Math.round(to * (1 - Math.pow(1 - k, 3)));
        el.textContent = sep ? nf.format(v) : String(v);
        if (k < 1) requestAnimationFrame(tick);
      })(t0);
    });
  }

  /* ---------- lueur qui suit le curseur sur les cartes ---------- */
  if (!coarse.matches) {
    $$('.pillar').forEach(card => {
      card.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
        card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
      });
    });
  }

  /* ==========================================================
     5. Menu du téléphone
     ========================================================== */
  const burger = $('#burger');
  const drawer = $('#nav-drawer');

  function setDrawer(open) {
    drawerOpen = open;
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    if (open) {
      drawer.hidden = false;
      requestAnimationFrame(() => drawer.classList.add('is-open'));
      html.style.overflow = 'hidden';
    } else {
      drawer.classList.remove('is-open');
      html.style.overflow = '';
      setTimeout(() => { if (!drawerOpen) drawer.hidden = true; }, 400);
    }
  }
  burger.addEventListener('click', () => setDrawer(!drawerOpen));
  drawer.addEventListener('click', e => { if (e.target.closest('a')) setDrawer(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && drawerOpen) setDrawer(false); });

  /* ---------- lien actif ---------- */
  const navLinks = $$('.nav__links a');
  if ('IntersectionObserver' in window) {
    const spy = new IntersectionObserver(es => {
      es.forEach(e => {
        if (!e.isIntersecting) return;
        const id = '#' + e.target.id;
        navLinks.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['projet', 'preuve', 'simulateur', 'plan', 'investisseurs', 'questions']
      .map(id => doc.getElementById(id)).filter(Boolean).forEach(s => spy.observe(s));
  }

  /* ==========================================================
     6. Le simulateur
     ========================================================== */
  const TAUX = 0.075;          // taux annuel indicatif
  const RENDEMENT = 0.07;      // loyer annuel indicatif, en part du prix
  const fmt = n => nf.format(Math.round(n));

  const apport = $('#apport'), duree = $('#duree');
  const outs = {
    apportOut: $('#apportOut'), dureeOut: $('#dureeOut'),
    prix: $('#prix'), apportV: $('#apportV'), mensu: $('#mensu'),
    loyer: $('#loyer'), rdt: $('#rdt')
  };
  const simuWa = $('#simuWa');

  function rangeFill(el) {
    const p = (el.value - el.min) / (el.max - el.min) * 100;
    el.style.setProperty('--p', p + '%');
  }

  function computeSimu() {
    const picked = $('input[name="type"]:checked');
    const prix = Number(picked.value);
    const label = picked.dataset.label;
    const ap = Number(apport.value) / 100;
    const ans = Number(duree.value);

    const apportF = prix * ap;
    const emprunt = prix - apportF;
    const i = TAUX / 12, n = ans * 12;
    const mensu = i === 0 ? emprunt / n : emprunt * i / (1 - Math.pow(1 + i, -n));
    const loyer = prix * RENDEMENT / 12;

    outs.apportOut.value = Math.round(ap * 100) + ' %';
    outs.dureeOut.value = ans + ' ans';
    outs.prix.textContent = fmt(prix);
    outs.apportV.textContent = fmt(apportF);
    outs.mensu.textContent = fmt(mensu);
    outs.loyer.textContent = fmt(loyer);
    outs.rdt.textContent = (RENDEMENT * 100).toFixed(1).replace('.', ',') + ' %';

    simuWa.href = waLink(
      'Bonjour IMMO+ Afrique. J\'ai fait le calcul sur votre site.\n' +
      '• Logement : ' + label + '\n' +
      '• Prix : ' + fmt(prix) + ' FCFA\n' +
      '• Apport : ' + Math.round(ap * 100) + ' % soit ' + fmt(apportF) + ' FCFA\n' +
      '• Crédit sur ' + ans + ' ans, mensualité estimée ' + fmt(mensu) + ' FCFA\n' +
      'Je voudrais en parler avec vous.'
    );
  }

  if (apport && duree) {
    [apport, duree].forEach(el => {
      rangeFill(el);
      el.addEventListener('input', () => { rangeFill(el); computeSimu(); });
    });
    $$('input[name="type"]').forEach(r => r.addEventListener('change', computeSimu));
    computeSimu();
  }

  /* ==========================================================
     7. Le plan de masse
     ========================================================== */
  const PLAN = {
    residences: ['Les Résidences', 'Six bâtiments de quatre niveaux, orientés pour que le vent de la lagune traverse chaque appartement. Cour plantée au centre, parking en sous-sol, groupe électrogène commun.', '2 min à pied de la clinique'],
    clinique:   ['La Clinique', 'Urgences ouvertes jour et nuit, maternité, soins intensifs, laboratoire et pharmacie. Une ambulance reste basée sur le site.', '3 min à pied des résidences'],
    galerie:    ['La Galerie', 'Supermarché, quarante commerces, restauration, agence bancaire et point Mobile Money. Le loyer des commerces paie l\'entretien des parties communes.', '4 min à pied de tout le quartier'],
    ecole:      ['L\'école et la crèche', 'Une crèche et une école primaire à l\'intérieur du quartier. Les enfants y vont à pied, sans traverser une seule route passante.', '5 min à pied des résidences'],
    place:      ['La place et le bassin', 'Une place couverte pour le marché du week-end et un bassin de rétention qui protège le quartier des pluies de juin.', 'Au centre du plan'],
    parc:       ['Le parc planté', 'Deux hectares gardés en pleine terre, arbres d\'ombre et terrain de sport. Rien ne sera construit dessus, c\'est inscrit au plan déposé.', '1 min à pied des résidences']
  };
  const planTitle = $('#planTitle'), planText = $('#planText'), planWalk = $('#planWalk');
  const pins = $$('.pin');

  function selectPin(pin) {
    const d = PLAN[pin.dataset.key];
    if (!d) return;
    pins.forEach(p => p.classList.toggle('is-on', p === pin));
    planTitle.textContent = d[0];
    planText.textContent = d[1];
    planWalk.textContent = d[2];
  }
  pins.forEach(p => {
    p.addEventListener('click', () => selectPin(p));
    p.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectPin(p); }
    });
  });
  if (pins[0]) pins[0].classList.add('is-on');

  /* ==========================================================
     8. Questions, ouverture douce
     ========================================================== */
  $$('.qa').forEach(qa => {
    const panel = qa.querySelector('div');
    const sum = qa.querySelector('summary');
    if (!panel || !sum) return;
    sum.addEventListener('click', e => {
      if (reduce.matches) return;
      e.preventDefault();
      const open = qa.open;
      if (!open) {
        qa.open = true;
        panel.style.height = '0px';
        requestAnimationFrame(() => {
          panel.style.transition = 'height .45s cubic-bezier(.16,1,.3,1)';
          panel.style.height = panel.scrollHeight + 'px';
        });
        panel.addEventListener('transitionend', function done() {
          panel.style.height = ''; panel.style.transition = '';
          panel.removeEventListener('transitionend', done);
        });
      } else {
        panel.style.height = panel.scrollHeight + 'px';
        requestAnimationFrame(() => {
          panel.style.transition = 'height .35s cubic-bezier(.22,.61,.36,1)';
          panel.style.height = '0px';
        });
        panel.addEventListener('transitionend', function done() {
          qa.open = false; panel.style.height = ''; panel.style.transition = '';
          panel.removeEventListener('transitionend', done);
        });
      }
    });
  });

  /* ==========================================================
     9. Le formulaire, qui ouvre WhatsApp
     ========================================================== */
  const form = $('#waForm');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const nom = $('#fNom').value.trim();
      const err = $('#formErr');
      if (!nom) {
        err.hidden = false;
        $('#fNom').focus();
        return;
      }
      err.hidden = true;
      const besoin = $('#fBesoin').value;
      const mot = $('#fMot').value.trim();
      const msg = 'Bonjour IMMO+ Afrique.\n' +
        'Je m\'appelle ' + nom + '.\n' +
        'Je cherche : ' + besoin + '.' +
        (mot ? '\n' + mot : '');
      $('#formNote').hidden = false;
      window.open(waLink(msg), '_blank', 'noopener');
    });
  }

  /* ==========================================================
     10. Démarrage
     ========================================================== */
  measure();
  readProgress();
  if (!reduce.matches) { kick(); tryVideo(); }
  else { paintScene(0); bands.forEach(b => { b.style.opacity = 1; b.style.transform = 'none'; }); }

  // en mouvement réduit la boucle ne doit jamais repartir :
  // elle réécrirait l'opacité des phrases posées à la main
  addEventListener('load', () => { measure(); readProgress(); kick(); });
})();
