# Edge Functions — NATHAN KIDS

## `auth` — login PIN + émission des JWT

Orchestration de l'authentification : appelle les fonctions SQL `auth_*`
(`0004_auth.sql`) via RPC (clé service-role), puis **signe** les tokens.

### Secrets requis

```bash
# Fournis par défaut par Supabase : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
# À ajouter — le secret JWT du projet (Dashboard → Project Settings → API → JWT Secret) :
supabase secrets set JWT_SECRET="<le JWT secret du projet>"
```

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
| `/auth/refresh` | `{ refreshToken }` | `200` `{ accessToken }` |
| `/auth/reset-pin` | `{ shopId, step, phone, newPin? }` | `200` `{ ok }` |

### Claims du token d'accès

```json
{ "sub": "<userId>", "aud": "authenticated", "role": "authenticated",
  "user_role": "admin|staff", "shop_id": "<uuid>", "user_id": "<uuid>",
  "iat": 0, "exp": 0 }
```

`role: authenticated` = rôle Postgres attendu par Supabase ; `user_role` = rôle
applicatif lu par la RLS (`auth_role()` → `is_admin()`).

### À durcir en production (ARCHITECTURE.md §3/§7)

- **Rate-limiting** anti-brute-force sur `/login` et `/reset-pin`.
- **Refresh tokens** : ici stateless (non révocables). Passer à un stockage
  serveur + rotation.
- **OTP SMS** au reset (remplacer la simple correspondance du téléphone).

## Le reste de l'API

Les autres endpoints d'`API_SPEC.md` sont servis directement par **PostgREST** :

- Tables (`GET/POST/PATCH`) exposées automatiquement, filtrées par la RLS.
- Opérations métier via **RPC** : `POST /rest/v1/rpc/finalize_sale`,
  `pay_credit`, `restock`, `adjust_stock`, `inventory_count`, `money_move`,
  `auth_add_staff`, `auth_remove_staff`, `attendance_logout`, `sales_daily`,
  `sync_since`.

Toujours envoyer l'en-tête `Authorization: Bearer <accessToken>`.
