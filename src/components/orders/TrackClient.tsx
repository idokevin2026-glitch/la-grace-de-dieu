"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SectionHead, wrap } from "@/components/ui/Form";
import { OrderTimeline } from "@/components/orders/OrderTimeline";
import { NewsletterBand } from "@/components/layout/NewsletterBand";
import { fcfa, STATUS_STEPS, WHATSAPP_DISPLAY } from "@/lib/constants";

interface TrackedOrder {
  ref: string;
  status: string;
  created_at: string;
  total: number;
  items: { name: string; price: number; qty: number }[];
  commune: string;
  address: string;
}

export function TrackClient() {
  const searchParams = useSearchParams();
  const initialRef = searchParams.get("ref") || "";
  const [ref, setRef] = useState(initialRef);
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);

  const search = async () => {
    if (!ref.trim()) return;
    setBusy(true);
    setSearched(true);
    const res = await fetch(`/api/orders/track?ref=${encodeURIComponent(ref.trim())}`);
    const data = await res.json();
    setOrder(data.order || null);
    setBusy(false);
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial lookup triggered by the ?ref= URL param, not derivable from render
    if (initialRef) search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
    <div className="fade-in" style={{ ...wrap, maxWidth: 720, padding: "48px 24px 90px" }}>
      <SectionHead eyebrow="Suivi" title="Suivre ma commande" sub="Entrez votre numéro de commande (ex. LG-2026-1234) pour connaître son état." />
      <div style={{ display: "flex", gap: 10, margin: "26px 0 30px", flexWrap: "wrap" }}>
        <input
          className="lg-input"
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          placeholder="LG-2026-1234"
          onKeyDown={(e) => e.key === "Enter" && search()}
          style={{ flex: "1 1 220px" }}
        />
        <Button variant="primary" onClick={search} disabled={busy}>
          <Icon name="search" size={17} /> Rechercher
        </Button>
      </div>

      {searched && !busy && !order && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--ink-soft)", background: "var(--paper)", border: "1px dashed var(--line)", borderRadius: 14 }}>
          Aucune commande trouvée pour ce numéro. Vérifiez la référence ou appelez le {WHATSAPP_DISPLAY}.
        </div>
      )}

      {order && (
        <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 16, padding: 24, boxShadow: "var(--shadow)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontFamily: "var(--font-marcellus),serif", fontSize: 22 }}>{order.ref}</div>
              <div style={{ fontSize: 13.5, color: "var(--ink-soft)" }}>
                Commandée le {new Date(order.created_at).toLocaleDateString("fr-FR")} · {fcfa(order.total)}
              </div>
            </div>
            <Badge tone={order.status === "livree" ? "green" : "gold"}>{STATUS_STEPS.find((s) => s.id === order.status)?.label || STATUS_STEPS[0].label}</Badge>
          </div>
          <OrderTimeline status={order.status} />
          <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14, display: "grid", gap: 8 }}>
            {order.items.map((it, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span style={{ color: "var(--ink-soft)" }}>
                  {it.qty} × {it.name}
                </span>
                <span style={{ fontWeight: 600 }}>{fcfa(it.price * it.qty)}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, fontSize: 13.5, color: "var(--ink-soft)" }}>
            <strong>Livraison :</strong> {order.commune} — {order.address}
          </div>
        </div>
      )}
    </div>
    <NewsletterBand />
    </>
  );
}
