"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { SectionHead, wrap } from "@/components/ui/Form";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { createClient } from "@/lib/supabase/client";
import { AdminCatalogue } from "@/components/admin/AdminCatalogue";
import { AdminOrders } from "@/components/admin/AdminOrders";

export default function AdminPage() {
  const { user, profile, loading, signOut } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"catalogue" | "commandes">("catalogue");

  if (loading) return null;

  if (!user) {
    const login = async () => {
      setBusy(true);
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
      setBusy(false);
      if (error) toast(error.message, { tone: "gold", icon: "x" });
    };
    return (
      <div className="fade-in" style={{ ...wrap, maxWidth: 420, padding: "70px 24px 100px" }}>
        <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 16, padding: 30, boxShadow: "var(--shadow)", textAlign: "center" }}>
          <div style={{ color: "var(--terracotta)", marginBottom: 12 }}>
            <Icon name="lock" size={34} />
          </div>
          <h1 style={{ fontSize: 26 }}>Espace administrateur</h1>
          <p style={{ color: "var(--ink-soft)", fontSize: 14, margin: "8px 0 20px" }}>Gérez le catalogue et suivez les commandes.</p>
          <input className="lg-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email administrateur" style={{ marginBottom: 10 }} />
          <input className="lg-input" type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Mot de passe" onKeyDown={(e) => e.key === "Enter" && login()} style={{ marginBottom: 12 }} />
          <Button variant="dark" full onClick={login} disabled={busy}>
            Entrer
          </Button>
        </div>
      </div>
    );
  }

  if (!profile || profile.role !== "admin") {
    return (
      <div className="fade-in" style={{ ...wrap, maxWidth: 420, padding: "70px 24px 100px", textAlign: "center" }}>
        <div style={{ color: "var(--terracotta)", marginBottom: 12 }}>
          <Icon name="lock" size={34} />
        </div>
        <h1 style={{ fontSize: 24 }}>Accès réservé</h1>
        <p style={{ color: "var(--ink-soft)", fontSize: 14, margin: "8px 0 20px" }}>Ce compte n&apos;a pas les droits administrateur.</p>
        <Button variant="outline" onClick={signOut}>
          Se déconnecter
        </Button>
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
