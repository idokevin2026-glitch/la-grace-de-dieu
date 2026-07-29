# NATHAN KIDS — PWA (front)

Application installable (PWA) en **JavaScript pur, sans étape de build**. Recâble
l'UX du prototype (`Nathan Kids Stock.dc.html`) sur l'API Supabase réelle, avec
un fonctionnement **offline-first** (file d'attente + idempotence).

## Fichiers

```
web/
  index.html            coquille + enregistrement du service worker
  styles.css            thème mobile-first (clair/sombre)
  manifest.webmanifest  métadonnées PWA (installable)
  sw.js                 service worker : cache de la coquille (offline)
  icons/                icônes 192 / 512
  config.example.js     -> copier en config.js (non versionné)
  js/
    api.js              session/JWT, PostgREST, RPC, OUTBOX offline-first
    api.test.js         tests Node de l'outbox (node js/api.test.js)
    app.js              écrans : login PIN, accueil, vente, stock, crédits,
                        fiche du jour, caisse & équipe (admin)
```

## Configuration

```bash
cp config.example.js config.js
# éditez config.js : SUPABASE_URL, SUPABASE_ANON_KEY, FUNCTIONS_URL
```

## Lancer en local

N'importe quel serveur statique (le service worker exige http(s), pas `file://`) :

```bash
npx serve web            # ou : python3 -m http.server -d web 3000
```

Puis ouvrez `http://localhost:3000`. Au **premier lancement**, choisissez
« Première utilisation ? Créer la boutique » (signup admin) — cela crée la
boutique + l'admin via l'Edge Function `auth`.

## Rôles

- **admin** : tout, y compris finances (bénéfice, marge, caisse/banque, équipe).
- **staff** (vendeuse) : ventes + stock ; les chiffres financiers sont masqués
  (imposé **côté serveur** par la RLS et la vue `products_api`, pas seulement par
  l'UI). La connexion d'une vendeuse ouvre automatiquement une session de présence.

## Offline-first

- Les **lectures** viennent du cache local (`sync_since`) puis se rafraîchissent.
- Les **écritures** (vente, réassort, ajustement, crédit, caisse) passent par
  l'**outbox** : enregistrées localement puis rejouées à la reconnexion. La vente
  porte un `idempotencyKey` → pas de double encaissement même si la requête est
  rejouée (ARCHITECTURE.md §4). Le badge ⌛ de la barre du haut indique le nombre
  d'opérations en attente ; le bouton ↻ force une synchro.
- Une écriture refusée par le serveur (ex. `insufficient_stock`) est retirée de
  la file et **consignée** (`localStorage nk.failed`) pour réconciliation.

## Déploiement

Hébergement statique (Vercel, Netlify, Supabase Storage, Nginx…). Servez le
dossier `web/` tel quel, avec les variables renseignées dans `config.js` au build
ou injectées à la volée. Pensez à déployer aussi l'Edge Function `auth`
(voir `../supabase/functions/README.md`) et à appliquer les migrations.

## Périmètre

Parcours quotidien complet : connexion, tableau de bord, encaissement
(multi-lignes, 5 modes de paiement, crédit client), gestion de stock (réassort,
ajustement, **ajout de produit** avec EAN-13 valide généré), **inventaire
physique** multi-produits (seuls les écarts sont enregistrés), **scan
code-barres** (caméra via `BarcodeDetector`, repli saisie manuelle),
recouvrement de crédits, fiche du jour avec **export Excel (CSV)** et **PDF**
(impression navigateur), et — pour l'admin — caisse/banque + gestion de l'équipe.

Modules utilitaires testés (Node) : `js/barcode.js` (EAN-13 + clé de contrôle,
`js/barcode.test.js`) et `js/api.js` (outbox offline, `js/api.test.js`).

Sécurité en place : rate-limit `/auth/*`, journal d'audit, refresh tokens à
rotation, et reset du PIN par **OTP SMS** (écran « Code oublié ? »). Il ne reste
qu'à brancher un fournisseur SMS via les secrets de l'Edge Function.
