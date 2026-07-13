"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { ProductCard } from "@/components/ui/ProductCard";
import { SectionHead, wrap } from "@/components/ui/Form";
import { CATEGORIES } from "@/lib/constants";
import type { Product, Category } from "@/lib/types";

// Le parent monte ce composant avec key={`${cat}-${filter}`} : une nouvelle URL de filtre
// démonte/remonte ce composant, donc l'état local repart de zéro sans effet de synchronisation.
export function ShopClient({ products, initialCat, initialFilterNew }: { products: Product[]; initialCat: string; initialFilterNew: boolean }) {
  const [cat, setCat] = useState(initialCat);
  const [q, setQ] = useState("");
  const [onlyNew, setOnlyNew] = useState(initialFilterNew);
  const [sort, setSort] = useState<"recent" | "price-asc" | "price-desc">("recent");

  let list = products.filter((p) => cat === "all" || p.category === cat);
  if (onlyNew) list = list.filter((p) => p.is_new);
  if (q.trim()) {
    const s = q.trim().toLowerCase();
    list = list.filter((p) => (p.name + " " + p.description).toLowerCase().includes(s));
  }
  list = [...list].sort((a, b) =>
    sort === "price-asc" ? a.price - b.price : sort === "price-desc" ? b.price - a.price : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const categoryMeta = CATEGORIES.find((c) => c.id === cat);

  return (
    <div className="fade-in" style={{ ...wrap, padding: "40px 24px 80px" }}>
      <SectionHead
        eyebrow="Boutique"
        title={cat === "all" ? "Tous nos articles" : categoryMeta?.label || "Boutique"}
        sub={cat === "all" ? "Pagnes, tenues et accessoires faits main." : categoryMeta?.tagline}
      />

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", margin: "28px 0 8px" }}>
        <div style={{ position: "relative", flex: "1 1 240px", maxWidth: 340 }}>
          <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--ink-soft)" }}>
            <Icon name="search" size={18} />
          </span>
          <input className="lg-input" placeholder="Rechercher un article…" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 40 }} />
        </div>
        <select className="lg-input" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} style={{ width: "auto", cursor: "pointer" }}>
          <option value="recent">Plus récents</option>
          <option value="price-asc">Prix croissant</option>
          <option value="price-desc">Prix décroissant</option>
        </select>
        <label className="lg-chip" data-on={onlyNew} onClick={() => setOnlyNew((v) => !v)} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Icon name="sparkle" size={14} /> Nouveautés
        </label>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "6px 0 30px" }}>
        <button className="lg-chip" data-on={cat === "all"} onClick={() => setCat("all")}>
          Tout
        </button>
        {CATEGORIES.map((c) => (
          <button key={c.id} className="lg-chip" data-on={cat === c.id} onClick={() => setCat(c.id as Category)}>
            {c.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--ink-soft)" }}>
          <div style={{ marginBottom: 10 }}>
            <Icon name="search" size={30} />
          </div>
          Aucun article ne correspond. Essayez d&apos;élargir votre recherche.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 20 }}>
          {list.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
