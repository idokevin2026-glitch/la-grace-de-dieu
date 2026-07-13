"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { SectionHead, Row, Panel, Field, wrap } from "@/components/ui/Form";
import { useCart } from "@/components/providers/CartProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { COMMUNES, PAYMENTS, fcfa, tierFor, deliveryFee, POINT_RATE, POINT_VALUE } from "@/lib/constants";
import type { PaymentMethod } from "@/lib/types";

export default function CheckoutPage() {
  const router = useRouter();
  const { items, count, subtotal, clear } = useCart();
  const { profile } = useAuth();
  const toast = useToast();
  const tier = profile ? tierFor(profile.points) : null;

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    commune: "",
    address: "",
    note: "",
    pay: "wave" as PaymentMethod,
    usePoints: false,
    custom: false,
    mPoitrine: "",
    mTaille: "",
    mHanches: "",
    mLongueur: "",
    mNote: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  useEffect(() => {
    // Prefills from the profile once it loads asynchronously after mount; not known at initial render.
    if (profile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm((f) => ({ ...f, name: f.name || profile.name, phone: f.phone || profile.phone, email: f.email || profile.email || "" }));
    }
  }, [profile]);
  useEffect(() => {
    if (count === 0 && !busy) router.replace("/shop");
  }, [count, busy, router]);

  if (count === 0) return null;

  const fee = deliveryFee(form.commune, tier);
  const maxRedeem = profile ? Math.min(profile.points * POINT_VALUE, Math.round(subtotal * 0.5)) : 0;
  const redeemPts = form.usePoints && profile ? Math.floor(Math.min(profile.points, Math.floor((subtotal * 0.5) / POINT_VALUE))) : 0;
  const redeemValue = redeemPts * POINT_VALUE;
  const total = Math.max(0, subtotal + fee - redeemValue);
  const pointsEarned = Math.floor(subtotal / POINT_RATE);

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Nom requis";
    if (!/^[0-9 +]{8,}$/.test(form.phone.trim())) e.phone = "Téléphone valide requis";
    if (!form.commune) e.commune = "Choisissez une zone";
    if (!form.address.trim()) e.address = "Adresse / quartier requis";
    setErrors(e);
    if (Object.keys(e).length) {
      toast("Vérifiez les champs en rouge.", { tone: "gold", icon: "x", title: "Formulaire incomplet" });
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((it) => ({ productId: it.productId, size: it.size, color: it.color, qty: it.qty })),
          customer: { name: form.name, phone: form.phone, email: form.email, commune: form.commune, address: form.address, note: form.note },
          payment: form.pay,
          usePoints: form.usePoints,
          measures: form.custom
            ? { poitrine: form.mPoitrine, taille: form.mTaille, hanches: form.mHanches, longueur: form.mLongueur, note: form.mNote }
            : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");

      clear();
      toast(`Réf. ${data.ref}`, { title: "Commande reçue ✓", tone: "green", icon: "check", duration: 5000 });
      router.push(`/confirm/${data.ref}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Impossible d'enregistrer la commande.", { tone: "gold", icon: "x" });
      setBusy(false);
    }
  };

  const payLabel = (id: string) => PAYMENTS.find((p) => p.id === id)?.label;

  return (
    <div className="fade-in" style={{ ...wrap, padding: "40px 24px 80px" }}>
      <SectionHead eyebrow="Finaliser" title="Votre commande" />
      <div className="resp2" style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 40, marginTop: 30, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 26 }}>
          <Panel title="Coordonnées" step="1">
            <Field label="Nom complet" err={errors.name}>
              <input className="lg-input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex. Aya Koffi" />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Téléphone" err={errors.phone}>
                <input className="lg-input" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="07 00 00 00 00" />
              </Field>
              <Field label="Email (facultatif)">
                <input className="lg-input" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="pour le suivi" />
              </Field>
            </div>
          </Panel>

          <Panel title="Livraison" step="2">
            <Field label="Zone de livraison" err={errors.commune}>
              <select className="lg-input" value={form.commune} onChange={(e) => set("commune", e.target.value)} style={{ cursor: "pointer" }}>
                <option value="">— Choisir —</option>
                {COMMUNES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Adresse / quartier / repère" err={errors.address}>
              <input className="lg-input" value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Ex. Gagnoa, quartier Dioulakro, près de la pharmacie" />
            </Field>
            <Field label="Instructions (facultatif)">
              <textarea className="lg-input" rows={2} value={form.note} onChange={(e) => set("note", e.target.value)} placeholder="Heure de disponibilité, code portail…" />
            </Field>
          </Panel>

          <section style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 16, padding: 22, boxShadow: "var(--shadow)" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
              <span style={{ width: 28, height: 28, borderRadius: 999, background: "var(--ink)", color: "var(--paper)", display: "grid", placeItems: "center" }}>
                <Icon name="ruler" size={16} />
              </span>
              <span style={{ flex: 1 }}>
                <span style={{ fontFamily: "var(--font-marcellus),serif", fontSize: 20, display: "block" }}>Confection sur-mesure</span>
                <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>Facultatif — indiquez vos mesures pour un ajustement parfait</span>
              </span>
              <input type="checkbox" checked={form.custom} onChange={(e) => set("custom", e.target.checked)} style={{ accentColor: "var(--terracotta)", width: 18, height: 18 }} />
            </label>
            {form.custom && (
              <div className="fade-in" style={{ marginTop: 18, display: "grid", gap: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <Field label="Tour de poitrine (cm)">
                    <input className="lg-input" value={form.mPoitrine} onChange={(e) => set("mPoitrine", e.target.value)} placeholder="Ex. 92" />
                  </Field>
                  <Field label="Tour de taille (cm)">
                    <input className="lg-input" value={form.mTaille} onChange={(e) => set("mTaille", e.target.value)} placeholder="Ex. 74" />
                  </Field>
                  <Field label="Tour de hanches (cm)">
                    <input className="lg-input" value={form.mHanches} onChange={(e) => set("mHanches", e.target.value)} placeholder="Ex. 100" />
                  </Field>
                  <Field label="Longueur souhaitée (cm)">
                    <input className="lg-input" value={form.mLongueur} onChange={(e) => set("mLongueur", e.target.value)} placeholder="Ex. 140" />
                  </Field>
                </div>
                <Field label="Précisions (manches, coupe, occasion…)">
                  <textarea className="lg-input" rows={2} value={form.mNote} onChange={(e) => set("mNote", e.target.value)} placeholder="Ex. manches longues, coupe ajustée pour un mariage" />
                </Field>
                <div style={{ fontSize: 12.5, color: "var(--ink-soft)", display: "flex", gap: 8, alignItems: "center" }}>
                  <Icon name="phone" size={14} /> Notre atelier vous rappellera pour confirmer les mesures avant la coupe.
                </div>
              </div>
            )}
          </section>

          <Panel title="Paiement" step="4">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {PAYMENTS.map((p) => (
                <label
                  key={p.id}
                  className="lg-card-hover"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "13px 15px",
                    borderRadius: 12,
                    cursor: "pointer",
                    border: "1.5px solid " + (form.pay === p.id ? "var(--terracotta)" : "var(--line)"),
                    background: form.pay === p.id ? "oklch(0.58 0.115 45 / .07)" : "var(--paper)",
                  }}
                >
                  <input type="radio" name="pay" checked={form.pay === p.id} onChange={() => set("pay", p.id)} style={{ accentColor: "var(--terracotta)" }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14.5 }}>{p.label}</div>
                    <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>{p.hint}</div>
                  </div>
                </label>
              ))}
            </div>
          </Panel>
        </div>

        <aside style={{ position: "sticky", top: 96, background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 16, padding: 24, boxShadow: "var(--shadow)" }}>
          <h3 style={{ fontSize: 20, marginBottom: 16 }}>Récapitulatif</h3>
          <div style={{ display: "grid", gap: 8, maxHeight: 200, overflow: "auto", marginBottom: 14, paddingRight: 4 }}>
            {items.map((it) => (
              <div key={it.key} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13.5 }}>
                <span style={{ color: "var(--ink-soft)" }}>
                  {it.qty} × {it.name}
                </span>
                <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{fcfa(it.price * it.qty)}</span>
              </div>
            ))}
          </div>
          <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
            <Row label="Sous-total" value={fcfa(subtotal)} />
            <Row label={"Frais d'expédition" + (form.commune ? " · " + form.commune : "")} value={fee === 0 ? "Offerts" : fcfa(fee)} />
            {redeemPts > 0 && <Row label={`Points fidélité (−${redeemPts})`} value={"−" + fcfa(redeemValue)} />}
          </div>

          {profile && profile.points > 0 && (
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "var(--paper-2)", padding: "11px 13px", borderRadius: 10, margin: "14px 0", cursor: "pointer", fontSize: 13.5 }}>
              <input type="checkbox" checked={form.usePoints} onChange={(e) => set("usePoints", e.target.checked)} style={{ accentColor: "var(--terracotta)", marginTop: 2 }} />
              <span>
                Utiliser mes <strong>{profile.points} points</strong> (jusqu&apos;à −{fcfa(maxRedeem)})
              </span>
            </label>
          )}

          <div style={{ borderTop: "1px solid var(--line)", margin: "12px 0" }} />
          <Row label="Total à payer" value={fcfa(total)} big />
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--green)", marginTop: 10 }}>
            <Icon name="sparkle" size={15} /> Vous gagnerez {pointsEarned} points fidélité
          </div>
          <Button variant="primary" full size="lg" style={{ marginTop: 18 }} onClick={submit} disabled={busy}>
            <Icon name="lock" size={17} /> {busy ? "Envoi…" : `Confirmer · ${fcfa(total)}`}
          </Button>
          <div style={{ fontSize: 11.5, color: "var(--ink-soft)", textAlign: "center", marginTop: 10 }}>Paiement via {payLabel(form.pay)} · vous recevrez une confirmation</div>
        </aside>
      </div>
    </div>
  );
}
