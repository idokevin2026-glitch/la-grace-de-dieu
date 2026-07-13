"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { wrap } from "@/components/ui/Form";
import { useToast } from "@/components/providers/ToastProvider";

export function NewsletterBand() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // localStorage is unavailable during SSR, so the real value can only be read post-mount.
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDone(!!localStorage.getItem("lagrace_news"));
    } catch {
      /* ignore */
    }
  }, []);

  const subscribe = async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      toast("Entrez un email valide.", { tone: "gold", icon: "x" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) throw new Error();
      try {
        localStorage.setItem("lagrace_news", email.trim());
      } catch {
        /* ignore */
      }
      setDone(true);
      toast("Vous êtes inscrit(e) ✓", { title: "Merci !", tone: "green", icon: "check" });
    } catch {
      toast("Impossible de vous inscrire pour l'instant.", { tone: "gold", icon: "x" });
    }
    setBusy(false);
  };

  return (
    <section style={{ position: "relative", overflow: "hidden", background: "var(--paper-2)" }}>
      <div className="wax-fill" style={{ position: "absolute", inset: 0, opacity: 0.12, ["--pat-bg" as string]: "#caa26b", ["--pat-fg" as string]: "rgba(43,32,23,.3)", ["--pat-fg2" as string]: "rgba(255,255,255,.25)" }} />
      <div style={{ ...wrap, position: "relative", padding: "48px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 36, alignItems: "center" }} className="resp2">
        <div>
          <div style={{ fontSize: 12.5, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--terracotta)", fontWeight: 700, marginBottom: 10 }}>Restez informé(e)</div>
          <h2 style={{ fontSize: "clamp(24px,3.5vw,34px)" }}>Recevez notre newsletter</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 16, marginTop: 10, marginBottom: 0 }}>
            Nouveaux arrivages, promotions du Cercle et inspirations en pagne, directement dans votre boîte mail.
          </p>
        </div>
        <div>
          {done ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 12, padding: "16px 18px" }}>
              <span style={{ color: "var(--green)" }}>
                <Icon name="check" size={22} />
              </span>
              <span>Merci, vous recevrez bientôt nos nouveautés !</span>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input
                className="lg-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Votre adresse email"
                onKeyDown={(e) => e.key === "Enter" && subscribe()}
                style={{ flex: "1 1 220px", background: "var(--paper)" }}
              />
              <Button variant="dark" onClick={subscribe} disabled={busy}>
                S&apos;inscrire
              </Button>
            </div>
          )}
          <p style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 10 }}>Pas de spam. Désinscription à tout moment.</p>
        </div>
      </div>
    </section>
  );
}
