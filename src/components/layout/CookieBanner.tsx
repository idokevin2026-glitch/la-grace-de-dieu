"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export function CookieBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    // localStorage is unavailable during SSR, so the real value can only be read post-mount.
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShow(!localStorage.getItem("lagrace_cookies"));
    } catch {
      setShow(true);
    }
  }, []);
  const decide = (v: string) => {
    try {
      localStorage.setItem("lagrace_cookies", v);
    } catch {
      /* ignore */
    }
    setShow(false);
  };
  if (!show) return null;
  return (
    <div
      className="fade-in"
      style={{
        position: "fixed",
        bottom: 20,
        left: 20,
        zIndex: 8500,
        width: "min(400px, calc(100vw - 40px))",
        background: "var(--ink)",
        color: "var(--paper)",
        borderRadius: 16,
        padding: "20px 22px",
        boxShadow: "var(--shadow-lg)",
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 22 }}>🍪</span>
        <strong style={{ fontFamily: "var(--font-marcellus),serif", fontSize: 19, fontWeight: 400 }}>Nous utilisons des cookies</strong>
      </div>
      <p style={{ fontSize: 13.5, color: "rgba(246,239,227,.8)", margin: "0 0 16px", lineHeight: 1.5 }}>
        Pour améliorer votre expérience, mémoriser votre panier et vos favoris. En continuant, vous acceptez notre{" "}
        <Link href="/legal/confidentialite" onClick={() => decide("accept")} style={{ color: "var(--gold)" }}>
          politique de confidentialité
        </Link>
        .
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Button variant="gold" size="sm" onClick={() => decide("accept")}>
          Tout accepter
        </Button>
        <Button variant="outline" size="sm" onClick={() => decide("essential")} style={{ color: "var(--paper)", borderColor: "rgba(246,239,227,.35)" }}>
          Essentiels uniquement
        </Button>
      </div>
    </div>
  );
}
