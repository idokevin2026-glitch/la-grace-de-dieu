# La Grâce de Dieu — site marchand

Site de vente en ligne (pagnes wax, tenues femmes/hommes/enfants, accessoires) pour **La Grâce de Dieu**, Gagnoa, Côte d'Ivoire. Implémentation en production du design réalisé sur Claude Design (`project/La Grâce.html`), en **Next.js 16 (App Router)** + **Supabase** (PostgreSQL, Auth, Storage).

## Stack

- **Next.js 16** (App Router, TypeScript, Turbopack)
- **Supabase** — base PostgreSQL, authentification, stockage des photos produits
- **CinetPay** — paiement Mobile Money / carte (Wave, Orange Money, MTN MoMo, Moov Money) — optionnel, désactivable
- **WhatsApp Cloud API** — notifications automatiques de commande — optionnel, désactivable
- **Anthropic API** — assistante IA « Grâce » — optionnel, désactivable

Chaque intégration externe (CinetPay, WhatsApp, Anthropic) est **gracieusement dégradée** si sa clé n'est pas configurée : le site reste pleinement fonctionnel sans elles (paiement redirigé vers WhatsApp/à la livraison, notifications limitées aux liens wa.me manuels, assistante affichant un message de repli).

## Démarrage

### 1. Créer le projet Supabase

1. Créez un projet sur [supabase.com](https://supabase.com).
2. Dans **SQL Editor**, exécutez dans l'ordre :
   - `supabase/migrations/0001_init.sql` (schéma + RLS + bucket de stockage)
   - `supabase/seed/seed_products.sql` (catalogue de départ, facultatif)
3. Copiez `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` et la clé **service_role** (Project Settings → API) dans `.env.local`.

### 2. Variables d'environnement

```bash
cp .env.example .env.local
```

Renseignez au minimum les 3 variables Supabase. Les autres (`CINETPAY_*`, `WHATSAPP_*`, `ANTHROPIC_API_KEY`) peuvent rester vides pour démarrer — voir « Intégrations optionnelles » ci-dessous.

### 3. Installer et lancer

```bash
npm install
npm run dev
```

Le site est disponible sur `http://localhost:3000`.

### 4. Créer le premier compte administrateur

1. Créez un compte normal via `/account` (email + mot de passe).
2. Dans Supabase → **Table Editor** → `profiles`, trouvez la ligne correspondante et passez `role` à `admin`.
3. Connectez-vous sur `/admin` avec ce compte.

Il n'y a **pas de mot de passe administrateur en dur** — l'accès `/admin` exige une session Supabase Auth avec `role = 'admin'`, imposé côté serveur par la RLS et par les routes API (`src/lib/api-auth.ts`).

## Intégrations optionnelles

| Service | Variables | Sans configuration |
|---|---|---|
| **CinetPay** (paiement) | `CINETPAY_API_KEY`, `CINETPAY_SITE_ID` | Le paiement en ligne n'est pas déclenché ; la commande est tout de même créée (`payment_status=pending`) et le client règle à la livraison / par virement / sur WhatsApp. |
| **WhatsApp Cloud API** (notifications auto) | `WHATSAPP_CLOUD_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | Aucune notification serveur envoyée, mais tous les liens `wa.me` (bouton « Commander sur WhatsApp », « Prévenir le client » en admin) restent pleinement fonctionnels. |
| **Anthropic** (assistante IA « Grâce ») | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (défaut `claude-opus-4-8`) | Le chat affiche un message de repli invitant à appeler le numéro WhatsApp de la boutique. |

Voir `.env.example` pour le détail de chaque variable.

### Activer CinetPay

1. Créez un compte marchand sur [cinetpay.com](https://cinetpay.com), récupérez `API_KEY` et `SITE_ID`.
2. Renseignez-les dans les variables d'environnement du déploiement.
3. Configurez l'URL de notification (webhook) sur `https://votre-domaine/api/payments/cinetpay/webhook` dans le tableau de bord CinetPay.

### Activer les notifications WhatsApp automatiques

1. Créez une app Meta for Developers avec le produit **WhatsApp Business Platform**.
2. Récupérez un token permanent et l'ID du numéro d'expéditeur.
3. Renseignez `WHATSAPP_CLOUD_TOKEN` et `WHATSAPP_PHONE_NUMBER_ID`.

### Activer l'assistante IA

1. Créez une clé API sur [console.anthropic.com](https://console.anthropic.com).
2. Renseignez `ANTHROPIC_API_KEY`.

## Déploiement (Vercel + Supabase)

1. Poussez ce dossier sur GitHub/GitLab.
2. Importez le repo sur [Vercel](https://vercel.com), racine du projet = `web/`.
3. Renseignez toutes les variables d'environnement de `.env.example` dans les réglages Vercel.
4. Déployez. Le proxy Next.js (`proxy.ts`) et les routes API tournent en runtime Node.js.
5. Ajoutez votre nom de domaine (`.ci` ou `.com`) dans Vercel → Domains.

## Structure du projet

```
src/
  app/                    routes (App Router) : pages + routes API (app/api/**)
  components/
    ui/                   composants partagés (Icon, Button, ProductCard, ClothImage…)
    layout/               Header, Footer, NewsletterBand, CookieBanner
    providers/            contexts client : Auth, Cart, Favorites, Toast
    shop/, orders/, admin/, assistant/   composants spécifiques à un domaine
  lib/
    constants.ts          tokens métier : catégories, paliers fidélité, zones de livraison…
    types.ts               types partagés
    supabase/               clients Supabase (browser / server / admin service-role)
    whatsapp.ts             notifications WhatsApp Cloud API (best-effort)
supabase/
  migrations/0001_init.sql schéma PostgreSQL + RLS + bucket Storage
  seed/seed_products.sql   catalogue de départ (identique au prototype de design)
proxy.ts                  rafraîchissement de session Supabase (ex-middleware Next.js)
```

## Règles métier

- **Fidélité** : 1 point par 1 000 FCFA dépensés ; 1 point = 100 FCFA de réduction (plafonné à 50 % du sous-total). Paliers : Perle (0 pt), Ivoire (30 pts, livraison Gagnoa offerte), Or (90 pts, livraison offerte).
- **Livraison** : Gagnoa 1 000 FCFA, autres villes 3 000 FCFA ; offerte pour Ivoire/Or.
- **Commandes** : recalculées et créées côté serveur (`POST /api/orders`) — le client n'a jamais autorité sur les prix ou totaux. Référence au format `LG-<année>-<4 chiffres>`.
- **Statuts** : `recue` → `prep` → `route` → `livree`, avancés depuis l'espace admin.

Détail complet du modèle de données et des endpoints : `../project/design_handoff_lagracededieu/DATA_MODEL_AND_API.md` (document de spécification d'origine, conservé pour référence).
