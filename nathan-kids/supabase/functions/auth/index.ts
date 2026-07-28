// ============================================================================
// NATHAN KIDS — Edge Function `auth` (Deno / Supabase)
// ----------------------------------------------------------------------------
// Login PIN => signe un JWT compatible Supabase (ARCHITECTURE.md §3).
// Routes (POST) :
//   /auth/signup      { shopName, owner, phone, pin }
//   /auth/login       { shopId, pin }
//   /auth/refresh     { refreshToken }
//   /auth/reset-pin   { shopId, step: 'verify'|'set', phone, newPin? }
//
// La logique métier vit dans les fonctions SQL (0004_auth.sql) ; cette fonction
// ne fait qu'orchestrer l'appel RPC (clé service-role) puis SIGNER les tokens.
//
// Secrets attendus (supabase secrets set …) :
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (fournis par défaut)
//   JWT_SECRET  = le secret JWT du projet (Project Settings → API → JWT Secret)
//
// ⚠ Prod : ajouter un rate-limiting anti-brute-force sur /login et /reset-pin,
// et une rotation/stockage des refresh tokens (ici stateless, non révocables).
// ============================================================================

import {
  create,
  verify,
  getNumericDate,
} from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const JWT_SECRET = Deno.env.get("JWT_SECRET")!;

const ACCESS_TTL_SEC = 15 * 60; // 15 min (JWT court, ARCHITECTURE.md §3)
const REFRESH_TTL_SEC = 30 * 24 * 60 * 60; // 30 jours

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Clé HMAC (HS256) dérivée du secret JWT du projet — les tokens signés ici sont
// donc acceptés par PostgREST/Realtime comme n'importe quel token Supabase.
const key = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(JWT_SECRET),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign", "verify"],
);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  });
}

function apiError(code: string, message: string, status: number, field?: string) {
  return json({ error: { code, message, field } }, status);
}

/** Appelle une fonction SQL via PostgREST RPC avec la clé service-role. */
async function rpc(fn: string, args: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
    },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw { pg: data, status: res.status };
  return data;
}

/** Traduit une erreur Postgres (message "code: détail") vers l'enveloppe API. */
function mapPgError(e: any): Response {
  const msg: string = e?.pg?.message ?? e?.message ?? "erreur";
  const head = String(msg).split(":")[0].trim();
  const table: Record<string, [number, string]> = {
    validation_error: [400, "validation_error"],
    invalid_pin: [401, "invalid_pin"],
    unauthenticated: [401, "unauthenticated"],
    forbidden: [403, "forbidden"],
    not_found: [404, "not_found"],
    conflict: [409, "conflict"],
    insufficient_stock: [422, "insufficient_stock"],
  };
  const [status, code] = table[head] ?? [400, "validation_error"];
  const field = head === "validation_error" ? msg.split(":")[1]?.trim() : undefined;
  return apiError(code, msg, status, field);
}

async function signAccess(identity: {
  shopId: string;
  userId: string;
  role: string;
}) {
  return await create(
    { alg: "HS256", typ: "JWT" },
    {
      iss: "nathan-kids",
      sub: identity.userId,
      aud: "authenticated",
      role: "authenticated", // rôle Postgres (Supabase)
      user_role: identity.role, // rôle applicatif (admin|staff)
      shop_id: identity.shopId,
      user_id: identity.userId,
      iat: getNumericDate(0),
      exp: getNumericDate(ACCESS_TTL_SEC),
    },
    key,
  );
}

async function signRefresh(identity: { shopId: string; userId: string; role: string }) {
  return await create(
    { alg: "HS256", typ: "JWT" },
    {
      sub: identity.userId,
      typ: "refresh",
      shop_id: identity.shopId,
      user_id: identity.userId,
      user_role: identity.role,
      exp: getNumericDate(REFRESH_TTL_SEC),
    },
    key,
  );
}

async function tokensFor(identity: { shopId: string; userId: string; role: string }) {
  return {
    accessToken: await signAccess(identity),
    refreshToken: await signRefresh(identity),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return apiError("not_found", "méthode", 404);

  const path = new URL(req.url).pathname.replace(/.*\/auth/, "") || "/";
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* corps vide toléré */
  }

  try {
    switch (path) {
      case "/signup": {
        const id = await rpc("auth_signup", {
          p_shop_name: body.shopName,
          p_owner: body.owner,
          p_phone: body.phone ?? null,
          p_pin: body.pin,
        });
        const identity = { shopId: id.shopId, userId: id.userId, role: id.role };
        return json(
          {
            ...(await tokensFor(identity)),
            user: { id: id.userId, name: id.name, role: id.role },
            shop: { id: id.shopId, name: id.shopName },
          },
          201,
        );
      }

      case "/login": {
        const id = await rpc("auth_login", { p_shop_id: body.shopId, p_pin: body.pin });
        const identity = { shopId: id.shopId, userId: id.userId, role: id.role };
        return json({
          ...(await tokensFor(identity)),
          user: { id: id.userId, name: id.name, role: id.role },
          attendanceSessionId: id.attendanceSessionId ?? undefined,
        });
      }

      case "/refresh": {
        if (!body.refreshToken) return apiError("unauthenticated", "refreshToken manquant", 401);
        let payload: any;
        try {
          payload = await verify(body.refreshToken, key);
        } catch {
          return apiError("unauthenticated", "refresh invalide/expiré", 401);
        }
        if (payload.typ !== "refresh") return apiError("unauthenticated", "type de token invalide", 401);
        const identity = {
          shopId: payload.shop_id,
          userId: payload.user_id,
          role: payload.user_role,
        };
        return json({ accessToken: await signAccess(identity) });
      }

      case "/reset-pin": {
        const r = await rpc("auth_reset_pin", {
          p_shop_id: body.shopId,
          p_step: body.step,
          p_phone: body.phone,
          p_new_pin: body.newPin ?? null,
        });
        return json(r);
      }

      default:
        return apiError("not_found", `route ${path} inconnue`, 404);
    }
  } catch (e) {
    return mapPgError(e);
  }
});
