"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, SectionHead, wrap } from "@/components/ui/Form";
import { NewsletterBand } from "@/components/layout/NewsletterBand";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { createClient } from "@/lib/supabase/client";
import { fcfa, tierFor, nextTier, TIERS, STATUS_STEPS, POINT_VALUE } from "@/lib/constants";
import type { Order } from "@/lib/types";

export default function AccountPage() {
  const { user, profile, loading, signOut } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [f, setF] = useState({ name: "", phone: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch("/api/me/orders")
      .then((r) => r.json())
      .then((d) => setOrders(d.orders || []));
  }, [user]);

  if (loading) return null;

  if (!user || !profile) {
    const submit = async () => {
      if (mode === "signup" && (!f.name.trim() || !/^[0-9 +]{8,}$/.test(f.phone.trim()))) {
        toast("Nom et téléphone valides requis.", { tone: "gold", icon: "x", title: "Champs manquants" });
        return;
      }
      if (!f.email.trim() || f.password.length < 6) {
        toast("Email et mot de passe (6 caractères min.) requis.", { tone: "gold", icon: "x" });
        return;
      }
      setBusy(true);
      const supabase = createClient();
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: f.email.trim(),
          password: f.password,
          options: { data: { name: f.name.trim(), phone: f.phone.trim() } },
        });
        if (error) toast(error.message, { tone: "gold", icon: "x" });
        else toast("Bienvenue au Cercle La Grâce de Dieu !", { title: "Compte créé", tone: "gold", icon: "star" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: f.email.trim(), password: f.password });
        if (error) toast(error.message, { tone: "gold", icon: "x" });
        else toast("Content de vous revoir !", { title: "Connecté", tone: "green", icon: "check" });
      }
      setBusy(false);
    };

    return (
      <>
      <div className="fade-in" style={{ ...wrap, maxWidth: 480, padding: "56px 24px 90px" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ color: "var(--gold)", marginBottom: 12 }}>
            <Icon name="star" size={38} />
          </div>
          <h1 style={{ fontSize: 34 }}>Cercle La Grâce de Dieu</h1>
          <p style={{ color: "var(--ink-soft)", marginTop: 8 }}>Rejoignez notre programme de fidélité et cumulez des points à chaque commande.</p>
        </div>
        <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 16, padding: 26, boxShadow: "var(--shadow)" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 22, background: "var(--paper-2)", borderRadius: 999, padding: 4 }}>
            {(
              [
                ["signup", "Créer un compte"],
                ["login", "J'ai déjà un compte"],
              ] as const
            ).map(([m, l]) => (
              <button
                key={m}
                className="lg-btn"
                onClick={() => setMode(m)}
                style={{ flex: 1, padding: "9px 0", borderRadius: 999, border: "none", fontSize: 14, background: mode === m ? "var(--paper)" : "transparent", color: "var(--ink)", boxShadow: mode === m ? "var(--shadow)" : "none" }}
              >
                {l}
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gap: 14 }}>
            {mode === "signup" && (
              <Field label="Nom complet">
                <input className="lg-input" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex. Aya Koffi" />
              </Field>
            )}
            {mode === "signup" && (
              <Field label="Téléphone">
                <input className="lg-input" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="07 00 00 00 00" />
              </Field>
            )}
            <Field label="Email">
              <input className="lg-input" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="vous@exemple.com" />
            </Field>
            <Field label="Mot de passe">
              <input className="lg-input" type="password" value={f.password} onChange={(e) => set("password", e.target.value)} placeholder="6 caractères min." />
            </Field>
            <Button variant="primary" full size="lg" onClick={submit} disabled={busy}>
              {mode === "signup" ? "Créer mon compte" : "Se connecter"}
            </Button>
          </div>
        </div>
        <p style={{ fontSize: 12.5, color: "var(--ink-soft)", textAlign: "center", marginTop: 16 }}>Vos données sont protégées et servent uniquement à gérer vos commandes et votre fidélité.</p>
      </div>
      <NewsletterBand />
      </>
    );
  }

  const tier = tierFor(profile.points);
  const next = nextTier(profile.points);
  const progress = next ? Math.min(100, Math.round(((profile.points - tier.min) / (next.min - tier.min)) * 100)) : 100;
  const totalSpent = orders.reduce((s, o) => s + o.total, 0);

  return (
    <>
    <div className="fade-in" style={{ ...wrap, padding: "40px 24px 90px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
        <div>
          <SectionHead eyebrow="Mon espace" title={`Bonjour, ${profile.name.split(" ")[0] || "vous"}`} />
          <p style={{ color: "var(--ink-soft)", marginTop: 6 }}>
            Membre depuis le {new Date(profile.created_at).toLocaleDateString("fr-FR")} · {profile.phone}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            await signOut();
            toast("À bientôt !", { icon: "check" });
          }}
        >
          Se déconnecter
        </Button>
      </div>

      <div className="resp2" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 24, marginBottom: 34 }}>
        <div style={{ position: "relative", overflow: "hidden", background: "var(--ink)", color: "var(--paper)", borderRadius: 20, padding: 28, boxShadow: "var(--shadow-lg)" }}>
          <div
            className="wax-fill"
            style={{ position: "absolute", inset: 0, opacity: 0.2, ["--pat-bg" as string]: "#3a2c1e", ["--pat-fg" as string]: "rgba(255,220,170,.6)", ["--pat-fg2" as string]: "rgba(200,140,60,.4)" }}
          />
          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: "var(--font-marcellus),serif", fontSize: 22, letterSpacing: ".02em" }}>Carte La Grâce de Dieu</span>
              <Badge tone="gold">Niveau {tier.label}</Badge>
            </div>
            <div style={{ marginTop: 26, fontSize: 15, color: "rgba(246,239,227,.7)" }}>Solde de points</div>
            <div style={{ fontSize: 52, fontFamily: "var(--font-marcellus),serif", lineHeight: 1, color: "var(--gold)" }}>
              {profile.points}
              <span style={{ fontSize: 18, color: "rgba(246,239,227,.7)", marginLeft: 8 }}>pts</span>
            </div>
            <div style={{ fontSize: 13, color: "rgba(246,239,227,.7)", marginTop: 4 }}>= {fcfa(profile.points * POINT_VALUE)} de réduction disponible</div>

            {next ? (
              <div style={{ marginTop: 22 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6, color: "rgba(246,239,227,.8)" }}>
                  <span>{tier.label}</span>
                  <span>
                    {next.min - profile.points} pts → {next.label}
                  </span>
                </div>
                <div style={{ height: 8, background: "rgba(255,255,255,.15)", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ width: progress + "%", height: "100%", background: "var(--gold)", borderRadius: 999, transition: "width .5s" }} />
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 20, fontSize: 13.5, color: "var(--gold)" }}>★ Vous profitez du niveau maximum !</div>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 13, color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: ".1em" }}>Vos avantages · {tier.label}</div>
            <div style={{ fontFamily: "var(--font-marcellus),serif", fontSize: 20, marginTop: 8 }}>{tier.perk}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Stat label="Commandes" value={orders.length} />
            <Stat label="Total dépensé" value={fcfa(totalSpent)} small />
          </div>
        </div>
      </div>

      <div className="resp3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 40 }}>
        {TIERS.map((t) => (
          <div key={t.id} style={{ border: "1.5px solid " + (t.id === tier.id ? "var(--terracotta)" : "var(--line)"), background: t.id === tier.id ? "oklch(0.58 0.115 45 / .06)" : "var(--paper)", borderRadius: 14, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: "var(--font-marcellus),serif", fontSize: 18 }}>{t.label}</span>
              {t.id === tier.id && <Badge tone="terracotta">Actuel</Badge>}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 4 }}>
              Dès {t.min} pts · {t.perk}
            </div>
          </div>
        ))}
      </div>

      <SectionHead eyebrow="Historique" title="Mes commandes" />
      {orders.length === 0 ? (
        <div style={{ background: "var(--paper)", border: "1px dashed var(--line)", borderRadius: 14, padding: 36, textAlign: "center", color: "var(--ink-soft)", marginTop: 20 }}>
          Aucune commande pour l&apos;instant.{" "}
          <Link href="/shop" style={{ cursor: "pointer" }}>
            Découvrir la boutique →
          </Link>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14, marginTop: 20 }}>
          {orders.map((o) => {
            const st = STATUS_STEPS.find((s) => s.id === o.status) || STATUS_STEPS[0];
            return (
              <div key={o.ref} style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 14, padding: "16px 18px", display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {o.ref} <span style={{ fontWeight: 400, color: "var(--ink-soft)", fontSize: 13 }}>· {new Date(o.created_at).toLocaleDateString("fr-FR")}</span>
                  </div>
                  <div style={{ fontSize: 13.5, color: "var(--ink-soft)", marginTop: 3 }}>
                    {o.items.reduce((s, i) => s + i.qty, 0)} article(s) · {fcfa(o.total)} · +{o.points_earned} pts
                  </div>
                </div>
                <Badge tone={o.status === "livree" ? "green" : "soft"}>{st.label}</Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
    <NewsletterBand />
    </>
  );
}

const Stat = ({ label, value, small }: { label: string; value: React.ReactNode; small?: boolean }) => (
  <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 16, padding: "18px 20px" }}>
    <div style={{ fontSize: 12.5, color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: ".08em" }}>{label}</div>
    <div style={{ fontFamily: "var(--font-marcellus),serif", fontSize: small ? 22 : 30, marginTop: 4 }}>{value}</div>
  </div>
);
