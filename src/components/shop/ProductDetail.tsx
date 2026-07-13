"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { ClothImage } from "@/components/ui/ClothImage";
import { ProductCard } from "@/components/ui/ProductCard";
import { QtyStepper } from "@/components/ui/QtyStepper";
import { Button } from "@/components/ui/Button";
import { SectionHead, wrap } from "@/components/ui/Form";
import { CATEGORIES, fcfa, POINT_RATE, waLink } from "@/lib/constants";
import { useCart } from "@/components/providers/CartProvider";
import { useFavorites } from "@/components/providers/FavoritesProvider";
import { useToast } from "@/components/providers/ToastProvider";
import type { Product } from "@/lib/types";

export function ProductDetail({ product, related }: { product: Product; related: Product[] }) {
  const { add } = useCart();
  const { has, toggle } = useFavorites();
  const toast = useToast();
  // Le parent monte ce composant avec key={product.id} : changer d'article démonte/remonte
  // ce composant, donc ces états repartent naturellement de zéro sans effet de synchronisation.
  const [size, setSize] = useState(product.sizes[0] || "");
  const [color, setColor] = useState(product.colors[0] || "");
  const [qty, setQty] = useState(1);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const category = CATEGORIES.find((c) => c.id === product.category);
  const fav = has(product.id);

  const onAdd = () => {
    add(product, size, color, qty);
    toast(`${qty} × ${product.name}`, { title: "Ajouté au panier", tone: "green", icon: "bag" });
  };

  return (
    <div className="fade-in" style={{ ...wrap, padding: "28px 24px 80px" }}>
      <div style={{ fontSize: 13.5, color: "var(--ink-soft)", marginBottom: 22, display: "flex", gap: 6, alignItems: "center" }}>
        <a href="/shop" style={{ color: "var(--ink-soft)" }}>
          Boutique
        </a>
        <Icon name="chevron" size={13} />
        <a href={`/shop?cat=${product.category}`} style={{ color: "var(--ink-soft)" }}>
          {category?.label}
        </a>
      </div>

      <div className="resp2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "start" }}>
        <div style={{ position: "sticky", top: 96 }}>
          <ClothImage product={product} ratio="4 / 5" rounded={18} label={false} />
        </div>
        <div>
          {product.is_new && (
            <Badge tone="terracotta" style={{ marginBottom: 14 }}>
              <Icon name="sparkle" size={12} /> Nouvel arrivage
            </Badge>
          )}
          <h1 style={{ fontSize: "clamp(28px,4vw,40px)", marginBottom: 12 }}>{product.name}</h1>
          <div style={{ fontSize: 26, fontWeight: 700, color: "var(--terracotta)", marginBottom: 20 }}>{fcfa(product.price)}</div>
          <p style={{ color: "var(--ink-soft)", fontSize: 16.5, marginBottom: 28 }}>{product.description}</p>

          {product.colors.length > 0 && (
            <div style={{ marginBottom: 22 }}>
              <div className="lg-label">Coloris — {color}</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {product.colors.map((c) => (
                  <button key={c} className="lg-chip" data-on={color === c} onClick={() => setColor(c)}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div style={{ marginBottom: 26 }}>
            <div className="lg-label">{product.category === "pagnes" ? "Métrage" : "Taille"}</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {product.sizes.map((s) => (
                <button key={s} className="lg-chip" data-on={size === s} onClick={() => setSize(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
            <QtyStepper value={qty} onChange={setQty} />
            <Button variant="primary" size="lg" onClick={onAdd} style={{ flex: "1 1 200px" }}>
              <Icon name="bag" size={18} /> Ajouter au panier
            </Button>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 26 }}>
            <Button
              variant="outline"
              onClick={() => {
                toggle(product.id);
                toast(fav ? "Retiré des favoris" : "Ajouté aux favoris", { icon: "heart", tone: "gold" });
              }}
              style={{ color: fav ? "var(--terracotta)" : "var(--ink)", borderColor: fav ? "var(--terracotta)" : "var(--line)" }}
            >
              <Icon name="heart" size={17} fill={fav ? "var(--terracotta)" : "none"} /> {fav ? "Dans mes favoris" : "Ajouter aux favoris"}
            </Button>
            <a
              href={waLink(`Bonjour La Grâce de Dieu ! Je suis intéressé(e) par « ${product.name} » (${fcfa(product.price)}). Est-il disponible ?`)}
              target="_blank"
              rel="noopener"
              className="lg-btn"
              style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 999, fontWeight: 600, fontSize: 15, padding: "11px 22px", textDecoration: "none", background: "#25D366", color: "#08341c" }}
            >
              <Icon name="whatsapp" size={18} /> Demander sur WhatsApp
            </a>
          </div>

          <div style={{ display: "grid", gap: 10, borderTop: "1px solid var(--line)", paddingTop: 22, fontSize: 14.5, color: "var(--ink-soft)" }}>
            <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <Icon name="truck" size={18} /> Livraison Gagnoa sous 24-48h · autres villes 3-5 jours
            </span>
            <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <Icon name="sparkle" size={18} /> Gagnez {Math.floor(product.price / POINT_RATE)} points fidélité avec cet article
            </span>
            <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <Icon name="heart" size={18} /> Confectionné main dans nos ateliers de Gagnoa
            </span>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <div style={{ marginTop: 72 }}>
          <SectionHead eyebrow="Vous aimerez aussi" title="Dans le même esprit" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 20, marginTop: 26 }}>
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
