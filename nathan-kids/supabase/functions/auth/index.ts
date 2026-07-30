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

import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const JWT_SECRET = Deno.env.get("JWT_SECRET")!;

const ACCESS_TTL_SEC = 15 * 60; // 15 min (JWT court, ARCHITECTURE.md §3)
const REFRESH_TTL_SEC = 30 * 24 * 60 * 60; // 30 jours

const CORS = {
  "Access-Control-Allow-Origin": "*",
  // Doit inclure TOUS les en-têtes envoyés par le client (dont `apikey`),
  // sinon le navigateur bloque la requête (preflight) => « Failed to fetch ».
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, prefer",
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

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  return (xff ? xff.split(",")[0] : req.headers.get("x-real-ip") || "unknown").trim();
}

// Code OTP à 6 chiffres, tiré d'une source cryptographique.
function genOtp(): string {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return String(a[0] % 1_000_000).padStart(6, "0");
}

// Envoi SMS — agnostique du fournisseur (dégradation gracieuse si non configuré).
//   SMS_PROVIDER = "twilio" | "generic" | (vide => non délivré)
//   twilio  : TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM
//   generic : SMS_WEBHOOK_URL (+ SMS_WEBHOOK_TOKEN) — POST {to,text} (Orange/MTN…)
async function sendSMS(to: string, text: string): Promise<boolean> {
  const provider = (Deno.env.get("SMS_PROVIDER") || "").toLowerCase();
  try {
    if (provider === "twilio") {
      const sid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
      const token = Deno.env.get("TWILIO_AUTH_TOKEN")!;
      const from = Deno.env.get("TWILIO_FROM")!;
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(`${sid}:${token}`),
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: from, Body: text }),
      });
      return res.ok;
    }
    if (provider === "generic") {
      const url = Deno.env.get("SMS_WEBHOOK_URL");
      if (!url) return false;
      const tok = Deno.env.get("SMS_WEBHOOK_TOKEN");
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
        body: JSON.stringify({ to, text }),
      });
      return res.ok;
    }
  } catch {
    return false;
  }
  return false; // aucun fournisseur configuré => à brancher en production
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

// ---- Refresh tokens OPAQUES (stockés côté serveur, avec rotation) ----------
// Un jeton aléatoire de 256 bits ; seul son SHA-256 est conservé en base
// (0007_refresh_tokens.sql). À chaque /refresh il est tourné (révoqué + ré-émis)
// et un rejeu d'un jeton déjà tourné coupe toute la session (reuse detection).
function genRefresh(): string {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Émet un refresh token (nouvelle session) et le persiste ; renvoie le jeton clair.
async function issueRefresh(identity: { shopId: string; userId: string }): Promise<string> {
  const token = genRefresh();
  await rpc("refresh_issue", {
    p_user: identity.userId,
    p_shop: identity.shopId,
    p_token_hash: await sha256hex(token),
    p_ttl_sec: REFRESH_TTL_SEC,
  });
  return token;
}

async function tokensFor(identity: { shopId: string; userId: string; role: string }) {
  return {
    accessToken: await signAccess(identity),
    refreshToken: await issueRefresh(identity),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    // Refléter les en-têtes demandés par le navigateur => aucun blocage CORS.
    const reqHeaders = req.headers.get("access-control-request-headers");
    return new Response("ok", {
      headers: { ...CORS, ...(reqHeaders ? { "Access-Control-Allow-Headers": reqHeaders } : {}) },
    });
  }
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
        // Anti-brute-force : 5 tentatives / 5 min par IP+boutique, verrou 5 min.
        const key = `login:${clientIp(req)}:${body.shopId}`;
        const allowed = await rpc("rate_check", { p_key: key, p_max: 5, p_window_sec: 300, p_lock_sec: 300 });
        if (allowed === false) {
          return apiError("too_many_attempts", "Trop de tentatives. Réessayez plus tard.", 429);
        }
        let id;
        try {
          id = await rpc("auth_login", { p_shop_id: body.shopId, p_pin: body.pin });
        } catch (e) {
          // Échec journalisé HORS de la transaction du RPC (qui a levé/annulé).
          await rpc("log_event", {
            p_event: "login_fail",
            p_detail: { ip: clientIp(req) },
            p_shop: body.shopId,
          }).catch(() => {});
          throw e;
        }
        await rpc("rate_reset", { p_key: key }).catch(() => {});
        await rpc("log_event", {
          p_event: "login_ok",
          p_detail: { ip: clientIp(req), role: id.role },
          p_shop: id.shopId,
          p_user: id.userId,
        }).catch(() => {});
        const identity = { shopId: id.shopId, userId: id.userId, role: id.role };
        return json({
          ...(await tokensFor(identity)),
          user: { id: id.userId, name: id.name, role: id.role },
          attendanceSessionId: id.attendanceSessionId ?? undefined,
        });
      }

      case "/refresh": {
        if (!body.refreshToken) return apiError("unauthenticated", "refreshToken manquant", 401);
        // Rotation : révoque l'ancien, émet un nouveau refresh. Un rejeu d'un
        // jeton déjà tourné coupe toute la session (reuse detection, en base).
        const newToken = genRefresh();
        const res: any = await rpc("refresh_rotate", {
          p_old_hash: await sha256hex(body.refreshToken),
          p_new_hash: await sha256hex(newToken),
          p_ttl_sec: REFRESH_TTL_SEC,
        });
        if (!res || res.ok !== true) {
          return apiError("unauthenticated", `refresh ${res?.error ?? "invalide"}`, 401);
        }
        const identity = { shopId: res.shopId, userId: res.userId, role: res.role };
        return json({ accessToken: await signAccess(identity), refreshToken: newToken });
      }

      case "/logout": {
        // Révoque le refresh présenté (déconnexion applicative).
        if (body.refreshToken) {
          await rpc("refresh_revoke", { p_token_hash: await sha256hex(body.refreshToken) }).catch(() => {});
        }
        return json({ ok: true });
      }

      case "/reset-pin": {
        // Reset par OTP SMS (0008_otp.sql). Anti-brute-force (fenêtre 15 min).
        const key = `reset:${clientIp(req)}:${body.shopId}`;
        const allowed = await rpc("rate_check", { p_key: key, p_max: 5, p_window_sec: 900, p_lock_sec: 900 });
        if (allowed === false) {
          return apiError("too_many_attempts", "Trop de tentatives. Réessayez plus tard.", 429);
        }

        // Étape 1 : envoi du code au numéro admin enregistré.
        if (body.step === "request") {
          const code = genOtp();
          const req0: any = await rpc("otp_request", {
            p_shop: body.shopId,
            p_purpose: "pin_reset",
            p_phone: body.phone,
            p_code_hash: await sha256hex(`${body.shopId}:${code}`),
            p_ttl_sec: 600, // 10 min
          });
          if (!req0 || req0.ok !== true) {
            // Ne pas révéler si le numéro correspond (anti-énumération).
            return json({ ok: true, delivered: false });
          }
          const delivered = await sendSMS(req0.phone, `NATHAN KIDS : votre code de réinitialisation est ${code} (valable 10 min).`);
          return json({ ok: true, delivered });
        }

        // Étape 2 : vérification du code puis pose du nouveau PIN.
        if (body.step === "set") {
          const v: any = await rpc("otp_verify", {
            p_shop: body.shopId,
            p_purpose: "pin_reset",
            p_code_hash: await sha256hex(`${body.shopId}:${body.code ?? ""}`),
          });
          if (!v || v.ok !== true) {
            return apiError("invalid_pin", `code ${v?.error ?? "invalide"}`, 401);
          }
          // Le code est validé : on pose le PIN (auth_reset_pin re-vérifie le tel).
          const r = await rpc("auth_reset_pin", {
            p_shop_id: body.shopId,
            p_step: "set",
            p_phone: body.phone,
            p_new_pin: body.newPin ?? null,
          });
          await rpc("rate_reset", { p_key: key }).catch(() => {});
          await rpc("log_event", { p_event: "pin_reset", p_detail: { ip: clientIp(req) }, p_shop: body.shopId }).catch(() => {});
          return json(r);
        }

        return apiError("validation_error", "step invalide (request|set)", 400, "step");
      }

      default:
        return apiError("not_found", `route ${path} inconnue`, 404);
    }
  } catch (e) {
    return mapPgError(e);
  }
});
