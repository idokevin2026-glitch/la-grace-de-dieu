"use client";

import Link from "next/link";
import { Icon } from "./Icon";
import { Badge } from "./Badge";
import { ClothImage } from "./ClothImage";
import { CATEGORIES, fcfa } from "@/lib/constants";
import { useFavorites } from "@/components/providers/FavoritesProvider";
import type { Product } from "@/lib/types";

export function ProductCard({ product }: { product: Product }) {
  const { has, toggle } = useFavorites();
  const fav = has(product.id);
  const category = CATEGORIES.find((c) => c.id === product.category);

  return (
    <Link
      href={`/product/${product.id}`}
      className="lg-card-hover"
      style={{
        cursor: "pointer",
        background: "var(--paper)",
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid var(--line)",
        boxShadow: "var(--shadow)",
        display: "block",
      }}
    >
      <div style={{ position: "relative" }}>
        <ClothImage product={product} />
        {product.is_new && (
          <div style={{ position: "absolute", top: 12, left: 12 }}>
            <Badge tone="terracotta">
              <Icon name="sparkle" size={12} /> Nouveauté
            </Badge>
          </div>
        )}
        <button
          className="lg-btn"
          aria-label="favori"
          title={fav ? "Retirer des favoris" : "Ajouter aux favoris"}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggle(product.id);
          }}
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 36,
            height: 36,
            borderRadius: 999,
            background: "rgba(252,248,241,.92)",
            border: "none",
            display: "grid",
            placeItems: "center",
            color: fav ? "var(--terracotta)" : "var(--ink-soft)",
            boxShadow: "var(--shadow)",
          }}
        >
          <Icon name="heart" size={19} fill={fav ? "var(--terracotta)" : "none"} />
        </button>
      </div>
      <div style={{ padding: "14px 16px 18px" }}>
        <div style={{ fontSize: 11.5, color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 5 }}>
          {category?.label}
        </div>
        <h3 style={{ fontSize: 18, marginBottom: 8, lineHeight: 1.2 }}>{product.name}</h3>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700, fontSize: 17 }}>{fcfa(product.price)}</span>
          <span style={{ fontSize: 13, color: "var(--terracotta)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 3 }}>
            Voir <Icon name="arrowRight" size={14} />
          </span>
        </div>
      </div>
    </Link>
  );
}
