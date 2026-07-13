"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ClothImage } from "@/components/ui/ClothImage";
import { Field } from "@/components/ui/Form";
import { useToast } from "@/components/providers/ToastProvider";
import { resizeImageToBlob } from "@/lib/resize-image";
import { CATEGORIES, SIZES_ADULT, SIZES_KID, fcfa } from "@/lib/constants";
import type { Category, Product } from "@/lib/types";

const emptyForm = {
  name: "",
  category: "pagnes" as Category,
  price: "",
  colors: "",
  sizesText: "",
  desc: "",
  isNew: true,
  image: null as string | null,
};

export function AdminCatalogue() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [f, setF] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  const load = () => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => setProducts(d.products || []));
  };
  useEffect(load, []);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const blob = await resizeImageToBlob(file);
      const form = new FormData();
      form.append("file", blob, "photo.jpg");
      const res = await fetch("/api/admin/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      set("image", data.url);
    } catch {
      toast("Image illisible ou trop lourde.", { tone: "gold", icon: "x" });
    }
    setBusy(false);
  };

  const resetForm = () => {
    setF(emptyForm);
    setEditId(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const startEdit = (p: Product) => {
    setEditId(p.id);
    setF({ name: p.name, category: p.category, price: String(p.price), colors: p.colors.join(", "), sizesText: p.sizes.join(", "), desc: p.description, isNew: p.is_new, image: p.image_url });
    formRef.current?.scrollIntoView({ block: "start" });
    window.scrollTo({ top: 0 });
  };

  const publish = async () => {
    if (!f.name.trim() || !f.price) {
      toast("Nom et prix requis.", { tone: "gold", icon: "x", title: "Champs manquants" });
      return;
    }
    const sizes = f.sizesText.trim()
      ? f.sizesText.split(",").map((s) => s.trim()).filter(Boolean)
      : f.category === "pagnes"
        ? ["6 yards"]
        : f.category === "enfants"
          ? SIZES_KID
          : f.category === "accessoires"
            ? ["Unique"]
            : SIZES_ADULT;
    const body = {
      name: f.name.trim(),
      category: f.category,
      price: parseInt(f.price, 10) || 0,
      colors: f.colors.trim() ? f.colors.split(",").map((c) => c.trim()).filter(Boolean) : ["Standard"],
      sizes,
      description: f.desc.trim() || "Nouvelle pièce de la collection La Grâce.",
      is_new: f.isNew,
      image_url: f.image,
    };

    setBusy(true);
    const res = await fetch(editId ? `/api/products/${editId}` : "/api/products", {
      method: editId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast(data.error || "Erreur lors de l'enregistrement.", { tone: "gold", icon: "x" });
      return;
    }
    toast(editId ? `« ${body.name} » mis à jour.` : `« ${body.name} » est en ligne.`, { title: editId ? "Article modifié ✓" : "Arrivage publié ✓", tone: "green", icon: editId ? "check" : "sparkle" });
    resetForm();
    load();
  };

  const remove = async (p: Product) => {
    if (!confirm(`Supprimer « ${p.name} » ?`)) return;
    const res = await fetch(`/api/products/${p.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast("Suppression impossible.", { tone: "gold", icon: "x" });
      return;
    }
    if (editId === p.id) resetForm();
    toast("Article supprimé.", { icon: "trash" });
    load();
  };

  const catCount = (id: string) => products.filter((p) => p.category === id).length;

  return (
    <>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 34 }}>
        {CATEGORIES.map((c) => (
          <div key={c.id} style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 12, padding: "10px 16px" }}>
            <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>{c.label}</span>
            <span style={{ fontFamily: "var(--font-marcellus),serif", fontSize: 20, marginLeft: 10 }}>{catCount(c.id)}</span>
          </div>
        ))}
      </div>

      <div className="resp2" style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 34, alignItems: "start" }}>
        <div ref={formRef} style={{ position: "sticky", top: 96, background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 16, padding: 24, boxShadow: "var(--shadow)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <h3 style={{ fontSize: 21 }}>{editId ? "Modifier l'article" : "Nouvel arrivage"}</h3>
            {editId && (
              <button className="lg-btn" onClick={resetForm} style={{ background: "none", border: "none", color: "var(--terracotta)", fontSize: 13.5, padding: 0 }}>
                + Nouveau
              </button>
            )}
          </div>
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <label className="lg-label">Photo de l&apos;article</label>
              <div
                onClick={() => fileRef.current?.click()}
                className="lg-card-hover"
                style={{ cursor: "pointer", border: "1.5px dashed var(--line)", borderRadius: 12, overflow: "hidden", aspectRatio: "4 / 3", display: "grid", placeItems: "center", background: "var(--paper-2)", position: "relative" }}
              >
                {f.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.image} alt="aperçu" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ textAlign: "center", color: "var(--ink-soft)" }}>
                    <Icon name="upload" size={28} />
                    <div style={{ fontSize: 13, marginTop: 8 }}>{busy ? "Traitement…" : "Cliquez ou glissez une image"}</div>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
              {f.image && (
                <button className="lg-btn" onClick={() => set("image", null)} style={{ background: "none", border: "none", color: "var(--ink-soft)", fontSize: 13, marginTop: 8, padding: 0 }}>
                  Retirer la photo
                </button>
              )}
            </div>
            <Field label="Nom de l'article">
              <input className="lg-input" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex. Robe wax « Adjoa »" />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Catégorie">
                <select className="lg-input" value={f.category} onChange={(e) => set("category", e.target.value as Category)} style={{ cursor: "pointer" }}>
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Prix (FCFA)">
                <input className="lg-input" type="number" value={f.price} onChange={(e) => set("price", e.target.value)} placeholder="12000" />
              </Field>
            </div>
            <Field label="Coloris (séparés par virgule)">
              <input className="lg-input" value={f.colors} onChange={(e) => set("colors", e.target.value)} placeholder="Indigo, Ocre, Émeraude" />
            </Field>
            <Field label="Tailles / métrage (facultatif)">
              <input className="lg-input" value={f.sizesText} onChange={(e) => set("sizesText", e.target.value)} placeholder="S, M, L, XL — laisser vide = auto" />
            </Field>
            <Field label="Description">
              <textarea className="lg-input" rows={3} value={f.desc} onChange={(e) => set("desc", e.target.value)} placeholder="Matière, coupe, occasion…" />
            </Field>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14.5 }}>
              <input type="checkbox" checked={f.isNew} onChange={(e) => set("isNew", e.target.checked)} style={{ accentColor: "var(--terracotta)" }} />
              Marquer comme « Nouveauté »
            </label>
            <Button variant="primary" full size="lg" onClick={publish} disabled={busy}>
              <Icon name={editId ? "check" : "upload"} size={17} /> {editId ? "Enregistrer les modifications" : "Publier sur la boutique"}
            </Button>
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: 21, marginBottom: 16 }}>Catalogue actuel · {products.length}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px,1fr))", gap: 14 }}>
            {products.map((p) => (
              <div key={p.id} style={{ background: "var(--paper)", border: "1px solid " + (editId === p.id ? "var(--terracotta)" : "var(--line)"), borderRadius: 12, overflow: "hidden", position: "relative" }}>
                <div style={{ position: "relative" }}>
                  <ClothImage product={p} ratio="1 / 1" rounded={0} label={false} />
                  {p.is_new && (
                    <div style={{ position: "absolute", top: 8, left: 8 }}>
                      <Badge tone="terracotta">New</Badge>
                    </div>
                  )}
                  <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 6 }}>
                    <button
                      className="lg-btn"
                      title="Modifier"
                      onClick={() => startEdit(p)}
                      style={{ width: 30, height: 30, borderRadius: 999, background: "rgba(252,248,241,.92)", color: "var(--ink)", border: "none", display: "grid", placeItems: "center", padding: 0 }}
                    >
                      <Icon name="edit" size={15} />
                    </button>
                    <button
                      className="lg-btn"
                      title="Supprimer"
                      onClick={() => remove(p)}
                      style={{ width: 30, height: 30, borderRadius: 999, background: "rgba(43,32,23,.7)", color: "#fff", border: "none", display: "grid", placeItems: "center", padding: 0 }}
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                </div>
                <div style={{ padding: "10px 12px 12px" }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.25, minHeight: 34 }}>{p.name}</div>
                  <div style={{ fontSize: 13, color: "var(--terracotta)", fontWeight: 700, marginTop: 4 }}>{fcfa(p.price)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
