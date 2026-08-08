"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Field, SectionHead, wrap } from "@/components/ui/Form";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { createClient } from "@/lib/supabase/client";
import { frAuthError } from "@/lib/auth-errors";
import { AdminCatalogue } from "@/components/admin/AdminCatalogue";
import { AdminOrders } from "@/components/admin/AdminOrders";

/** Promeut le compte connecté en admin s'il est autorisé (ADMIN_EMAILS). Best-effort. */
async function tryPromote(): Promise<boolean> {
  try {
    const res = await fetch("/api/admin/promote", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    return !!data.promoted;
  } catch {
    return false;
  }
}

/**
 * Pour un email admin autorisé : confirme le compte (sans dépendre de l'email
 * Supabase) et le passe admin. Renvoie true si le compte est prêt à se connecter.
 */
async function confirmAdmin(email: string): Promise<boolean> {
  try {
    const res = await fetch("/api/admin/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    return !!data.ok;
  } catch {
    return false;
  }
}

export default function AdminPage() {
  const { user, profile, loading, signOut, refreshProfile } = useAuth();
  const toast = useToast();
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"catalogue" | "commandes">("catalogue");

  if (loading) return null;

  if (!user) {
    const welcome = async () => {
      await tryPromote();
      await refreshProfile();
      setBusy(false);
      toast("Accès administrateur activé.", { tone: "green", icon: "check", title: "Bienvenue" });
    };

    const login = async () => {
      if (!email.trim() || pass.length < 6) {
        toast("Email et mot de passe (6 caractères min.) requis.", { tone: "gold", icon: "x" });
        return;
      }
      setBusy(true);
      const supabase = createClient();
      let { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
      if (error) {
        // Compte admin autorisé mais non confirmé : on confirme automatiquement puis on réessaie.
        if (await confirmAdmin(email.trim())) {
          ({ error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass }));
        }
      }
      if (error) {
        setBusy(false);
        toast(frAuthError(error.message), { tone: "gold", icon: "x", title: "Connexion impossible" });
        return;
      }
      await welcome();
    };

    // Configuration / réinitialisation sécurisée d'un compte admin via code d'installation.
    const setupAdmin = async () => {
      if (!email.trim() || pass.length < 6) {
        toast("Email et mot de passe (6 caractères min.) requis.", { tone: "gold", icon: "x" });
        return;
      }
      setBusy(true);
      const res = await fetch("/api/admin/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password: pass, secret: setupCode.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setBusy(false);
        toast(data.error || "Configuration impossible.", { tone: "gold", icon: "x", title: "Échec de la configuration" });
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
      if (error) {
        setBusy(false);
        toast(frAuthError(error.message), { tone: "gold", icon: "x", title: "Connexion impossible" });
        return;
      }
      await welcome();
    };

    const signup = async () => {
      // Si un code d'installation est saisi, on passe par la configuration admin sécurisée
      // (crée le compte au besoin, redéfinit le mot de passe, confirme et donne l'accès admin).
      if (setupCode.trim()) return setupAdmin();

      if (!name.trim() || !/^[0-9 +]{8,}$/.test(phone.trim())) {
        toast("Nom et téléphone valides requis.", { tone: "gold", icon: "x", title: "Champs manquants" });
        return;
      }
      if (!email.trim() || pass.length < 6) {
        toast("Email et mot de passe (6 caractères min.) requis.", { tone: "gold", icon: "x" });
        return;
      }
      setBusy(true);
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: pass,
        options: { data: { name: name.trim(), phone: phone.trim() } },
      });

      // Compte déjà existant, ou confirmation email requise (pas de session) :
      // pour un email admin autorisé, on confirme côté serveur puis on connecte.
      const needsHelp = !!error || !data.session;
      if (needsHelp) {
        if (await confirmAdmin(email.trim())) {
          const { error: e2 } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
          if (!e2) {
            await welcome();
            return;
          }
        }
        setBusy(false);
        if (error) {
          toast(frAuthError(error.message), { tone: "gold", icon: "x", title: "Création impossible" });
        } else {
          toast("Compte créé. Confirmez votre email (lien reçu par mail) puis connectez-vous.", {
            tone: "gold",
            icon: "star",
            title: "Vérifiez votre boîte mail",
          });
          setAuthMode("login");
        }
        return;
      }

      await welcome();
    };

    const submit = authMode === "login" ? login : signup;

    return (
      <div className="fade-in" style={{ ...wrap, maxWidth: 440, padding: "70px 24px 100px" }}>
        <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 16, padding: 30, boxShadow: "var(--shadow)" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "var(--terracotta)", marginBottom: 12 }}>
              <Icon name="lock" size={34} />
            </div>
            <h1 style={{ fontSize: 26 }}>Espace administrateur</h1>
            <p style={{ color: "var(--ink-soft)", fontSize: 14, margin: "8px 0 20px" }}>Gérez le catalogue et suivez les commandes.</p>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 20, background: "var(--paper-2)", borderRadius: 999, padding: 4 }}>
            {(
              [
                ["login", "J'ai déjà un compte"],
                ["signup", "Créer un compte"],
              ] as const
            ).map(([m, l]) => (
              <button
                key={m}
                className="lg-btn"
                onClick={() => setAuthMode(m)}
                style={{ flex: 1, padding: "9px 0", borderRadius: 999, border: "none", fontSize: 14, background: authMode === m ? "var(--paper)" : "transparent", color: "var(--ink)", boxShadow: authMode === m ? "var(--shadow)" : "none" }}
              >
                {l}
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {authMode === "signup" && (
              <>
                <Field label="Nom complet">
                  <input className="lg-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Kevin Ido" />
                </Field>
                <Field label="Téléphone">
                  <input className="lg-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07 00 00 00 00" />
                </Field>
              </>
            )}
            <Field label="Email">
              <input className="lg-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com" />
            </Field>
            <Field label="Mot de passe">
              <input className="lg-input" type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="6 caractères min." onKeyDown={(e) => e.key === "Enter" && submit()} />
            </Field>
            {authMode === "signup" && (
              <Field label="Code d'installation (facultatif)">
                <input className="lg-input" value={setupCode} onChange={(e) => setSetupCode(e.target.value)} placeholder="Réservé au responsable — laisser vide si vous ne l'avez pas" onKeyDown={(e) => e.key === "Enter" && submit()} />
                <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 5 }}>
                  Avec ce code, votre mot de passe est (re)défini et l&apos;accès administrateur activé immédiatement.
                </div>
              </Field>
            )}
            <Button variant="dark" full onClick={submit} disabled={busy}>
              {busy ? "Patientez…" : authMode === "login" ? "Entrer" : "Créer mon compte"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!profile || profile.role !== "admin") {
    const promote = async () => {
      setBusy(true);
      const promoted = await tryPromote();
      await refreshProfile();
      setBusy(false);
      if (!promoted)
        toast("Cet email n'est pas dans la liste des administrateurs autorisés (ADMIN_EMAILS).", { tone: "gold", icon: "x", title: "Accès refusé" });
    };
    return (
      <div className="fade-in" style={{ ...wrap, maxWidth: 440, padding: "70px 24px 100px", textAlign: "center" }}>
        <div style={{ color: "var(--terracotta)", marginBottom: 12 }}>
          <Icon name="lock" size={34} />
        </div>
        <h1 style={{ fontSize: 24 }}>Accès réservé</h1>
        <p style={{ color: "var(--ink-soft)", fontSize: 14, margin: "8px 0 20px" }}>
          Ce compte ({user.email}) n&apos;a pas encore les droits administrateur.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <Button variant="dark" onClick={promote} disabled={busy}>
            {busy ? "Vérification…" : "Activer l'accès administrateur"}
          </Button>
          <Button variant="outline" onClick={signOut}>
            Se déconnecter
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ ...wrap, padding: "40px 24px 90px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <SectionHead eyebrow="Administration" title="Espace administrateur" sub="Publiez vos arrivages et suivez vos commandes." />
        <Button variant="outline" size="sm" onClick={signOut}>
          Se déconnecter
        </Button>
      </div>

      <div style={{ display: "flex", gap: 8, margin: "22px 0 30px", background: "var(--paper-2)", borderRadius: 999, padding: 4, width: "fit-content" }}>
        {(
          [
            ["catalogue", "Catalogue"],
            ["commandes", "Commandes"],
          ] as const
        ).map(([id, l]) => (
          <button
            key={id}
            className="lg-btn"
            onClick={() => setTab(id)}
            style={{ padding: "9px 20px", borderRadius: 999, border: "none", fontSize: 14.5, fontWeight: tab === id ? 700 : 500, background: tab === id ? "var(--paper)" : "transparent", color: "var(--ink)", boxShadow: tab === id ? "var(--shadow)" : "none" }}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === "commandes" ? <AdminOrders /> : <AdminCatalogue />}
    </div>
  );
}
