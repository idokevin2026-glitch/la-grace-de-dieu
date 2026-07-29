# Edge Functions — NATHAN KIDS

## `auth` — login PIN + émission des JWT

Orchestration de l'authentification : appelle les fonctions SQL `auth_*`
(`0004_auth.sql`) via RPC (clé service-role), puis **signe** les tokens.

### Secrets requis

```bash
# Fournis par défaut par Supabase : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
# À ajouter — le secret JWT du projet (Dashboard → Project Settings → API → JWT Secret) :
supabase secrets set JWT_SECRET="<le JWT secret du projet>"

# OTP SMS au reset (optionnel — dégradation gracieuse si absent) :
#   Twilio :
supabase secrets set SMS_PROVIDER=twilio TWILIO_ACCOUNT_SID=… TWILIO_AUTH_TOKEN=… TWILIO_FROM="+225…"
#   ou passerelle générique (Orange/MTN…) : POST {to,text} vers un webhook
supabase secrets set SMS_PROVIDER=generic SMS_WEBHOOK_URL="https://…" SMS_WEBHOOK_TOKEN="…"
```

Sans fournisseur SMS configuré, `/auth/reset-pin` répond `{ ok:true, delivered:false }` :
le code est bien généré/stocké mais non envoyé — **à configurer pour la production**.

Le token d'accès est signé HS256 avec **ce même secret** : il est donc accepté
tel quel par PostgREST/Realtime, et la RLS lit `shop_id` / `user_role` dans ses
claims.

### Déploiement

```bash
supabase functions deploy auth --no-verify-jwt   # /auth/* est pré-auth
```

`--no-verify-jwt` car signup/login/refresh/reset s'appellent **sans** token.

### Routes

| Route (POST) | Corps | Réponse |
|---|---|---|
| `/auth/signup` | `{ shopName, owner, phone, pin }` | `201` `{ accessToken, refreshToken, user, shop }` |
| `/auth/login` | `{ shopId, pin }` | `200` `{ accessToken, refreshToken, user, attendanceSessionId? }` |
| `/auth/refresh` | `{ refreshToken }` | `200` `{ accessToken, refreshToken }` (rotation) |
| `/auth/logout` | `{ refreshToken }` | `200` `{ ok }` (révoque le refresh) |
| `/auth/reset-pin` (étape 1) | `{ shopId, step:"request", phone }` | `200` `{ ok, delivered }` (envoi OTP SMS) |
| `/auth/reset-pin` (étape 2) | `{ shopId, step:"set", phone, code, newPin }` | `200` `{ ok }` (code vérifié → nouveau PIN) |

### Claims du token d'accès

```json
{ "sub": "<userId>", "aud": "authenticated", "role": "authenticated",
  "user_role": "admin|staff", "shop_id": "<uuid>", "user_id": "<uuid>",
  "iat": 0, "exp": 0 }
```

`role: authenticated` = rôle Postgres attendu par Supabase ; `user_role` = rôle
applicatif lu par la RLS (`auth_role()` → `is_admin()`).

### Sécurité en place

- **Rate-limiting** anti-brute-force sur `/login` (5/5 min par IP+boutique) et
  `/reset-pin` (5/15 min), via `rate_check`/`rate_reset` (`0006_security.sql`),
  keyé par **IP** pour éviter de verrouiller toute la boutique.
- **Journal d'audit** (`auth_audit`) : `login_ok`/`login_fail`/`pin_reset`
  (par l'Edge Function) + recouvrement de crédit, mouvements de caisse et
  désactivation de vendeuse (déclencheurs SQL). Lecture réservée à l'admin.
- **Refresh tokens à rotation** (`0007_refresh_tokens.sql`) : jetons **opaques**
  stockés hachés (SHA-256) côté serveur. Chaque `/refresh` tourne le jeton
  (révoque l'ancien, en émet un nouveau) ; un rejeu d'un jeton déjà tourné
  **coupe toute la session** (reuse detection) ; `/logout` révoque ; un
  utilisateur désactivé voit sa session invalidée. Le client sérialise les
  rafraîchissements (single-flight) pour éviter les faux positifs de rejeu.
- **OTP SMS au reset du PIN** (`0008_otp.sql`) : code à 6 chiffres envoyé au
  numéro admin **enregistré**, stocké haché, expirant (10 min), limité en
  tentatives (5) et à usage unique. Anti-énumération : la réponse ne révèle pas
  si le numéro correspond.

> Toutes les mesures du §7 d'ARCHITECTURE.md sont désormais couvertes.

## Le reste de l'API

Les autres endpoints d'`API_SPEC.md` sont servis directement par **PostgREST** :

- Tables (`GET/POST/PATCH`) exposées automatiquement, filtrées par la RLS.
- Opérations métier via **RPC** : `POST /rest/v1/rpc/finalize_sale`,
  `pay_credit`, `restock`, `adjust_stock`, `inventory_count`, `money_move`,
  `auth_add_staff`, `auth_remove_staff`, `attendance_logout`, `sales_daily`,
  `sync_since`.

Toujours envoyer l'en-tête `Authorization: Bearer <accessToken>`.
