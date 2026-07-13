"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { ProductCard } from "@/components/ui/ProductCard";
import { SectionHead, wrap } from "@/components/ui/Form";
import { NewsletterBand } from "@/components/layout/NewsletterBand";
import { useFavorites } from "@/components/providers/FavoritesProvider";
import type { Product } from "@/lib/types";

export default function FavoritesPage() {
  const { ids } = useFavorites();
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    window.scrollTo(0, 0);
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => setProducts(d.products || []));
  }, []);

  const favs = products.filter((p) => ids.includes(p.id));

  return (
    <>
      <div className="fade-in" style={{ ...wrap, padding: "40px 24px 80px" }}>
        <SectionHead eyebrow="Ma sélection" title="Mes favoris" sub="Les pièces que vous avez mises de côté." />
        {favs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "70px 20px", color: "var(--ink-soft)" }}>
          <div style={{ marginBottom: 12 }}>
            <Icon name="heart" size={40} stroke={1.3} />
          </div>
          Vous n&apos;avez pas encore de favoris. Touchez le ♥ sur un article pour le retrouver ici.
          <div style={{ marginTop: 20 }}>
            <Link
              href="/shop"
              className="lg-btn"
              style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--terracotta)", color: "#fff", borderRadius: 999, fontWeight: 600, fontSize: 15, padding: "11px 22px" }}
            >
              Explorer la boutique
            </Link>
          </div>
        </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 20, marginTop: 28 }}>
            {favs.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
      <NewsletterBand />
    </>
  );
}
