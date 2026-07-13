"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { ClothImage } from "@/components/ui/ClothImage";
import { QtyStepper } from "@/components/ui/QtyStepper";
import { SectionHead, Row, wrap } from "@/components/ui/Form";
import { useCart } from "@/components/providers/CartProvider";
import { fcfa, waCartMessage, waLink } from "@/lib/constants";

export default function CartPage() {
  const { items, count, subtotal, setQty, remove } = useCart();

  if (count === 0) {
    return (
      <div className="fade-in" style={{ ...wrap, padding: "80px 24px", textAlign: "center", maxWidth: 560 }}>
        <div style={{ color: "var(--ink-soft)", marginBottom: 16 }}>
          <Icon name="bag" size={44} stroke={1.3} />
        </div>
        <h2 style={{ fontSize: 30 }}>Votre panier est vide</h2>
        <p style={{ color: "var(--ink-soft)", marginTop: 10, marginBottom: 26 }}>Parcourez nos pagnes et tenues faits main.</p>
        <Link
          href="/shop"
          className="lg-btn"
          style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--terracotta)", color: "#fff", borderRadius: 999, fontWeight: 600, fontSize: 16, padding: "14px 30px" }}
        >
          Explorer la boutique
        </Link>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ ...wrap, padding: "40px 24px 80px" }}>
      <SectionHead eyebrow="Votre sélection" title={`Panier · ${count} article${count > 1 ? "s" : ""}`} />
      <div className="resp2" style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 40, marginTop: 30, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 16 }}>
          {items.map((it) => (
            <div key={it.key} style={{ display: "grid", gridTemplateColumns: "92px 1fr auto", gap: 16, background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 14, padding: 14 }}>
              <Link href={`/product/${it.productId}`}>
                <ClothImage product={{ id: it.productId, name: it.name, category: it.category, image_url: it.image }} ratio="1 / 1" rounded={10} label={false} />
              </Link>
              <div>
                <Link href={`/product/${it.productId}`} style={{ color: "inherit" }}>
                  <h3 style={{ fontSize: 17.5 }}>{it.name}</h3>
                </Link>
                <div style={{ fontSize: 13, color: "var(--ink-soft)", margin: "4px 0 12px" }}>{[it.color, it.size].filter(Boolean).join(" · ")}</div>
                <QtyStepper value={it.qty} onChange={(q) => setQty(it.key, q)} />
              </div>
              <div style={{ textAlign: "right", display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "flex-end" }}>
                <button className="lg-btn" onClick={() => remove(it.key)} style={{ background: "none", border: "none", color: "var(--ink-soft)", padding: 4 }} aria-label="retirer">
                  <Icon name="trash" size={18} />
                </button>
                <div style={{ fontWeight: 700, fontSize: 16.5 }}>{fcfa(it.price * it.qty)}</div>
              </div>
            </div>
          ))}
        </div>

        <aside style={{ position: "sticky", top: 96, background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 16, padding: 24, boxShadow: "var(--shadow)" }}>
          <h3 style={{ fontSize: 20, marginBottom: 18 }}>Récapitulatif</h3>
          <Row label="Sous-total" value={fcfa(subtotal)} />
          <Row label="Frais d'expédition" value="calculés à la commande" muted />
          <div style={{ borderTop: "1px solid var(--line)", margin: "14px 0" }} />
          <Row label="Total estimé" value={fcfa(subtotal)} big />
          <Link
            href="/checkout"
            className="lg-btn"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", marginTop: 20, background: "var(--terracotta)", color: "#fff", borderRadius: 999, fontWeight: 600, fontSize: 16, padding: "14px 30px" }}
          >
            Passer la commande <Icon name="arrowRight" size={18} />
          </Link>
          <a
            href={waLink(waCartMessage(items, subtotal))}
            target="_blank"
            rel="noopener"
            className="lg-btn"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", marginTop: 10, borderRadius: 999, fontWeight: 600, fontSize: 15, padding: "11px 22px", textDecoration: "none", background: "#25D366", color: "#08341c" }}
          >
            <Icon name="whatsapp" size={18} /> Commander sur WhatsApp
          </a>
          <Link href="/shop" className="lg-btn" style={{ display: "block", textAlign: "center", background: "none", border: "none", color: "var(--ink-soft)", width: "100%", marginTop: 12, fontSize: 14 }}>
            Continuer mes achats
          </Link>
        </aside>
      </div>
    </div>
  );
}
