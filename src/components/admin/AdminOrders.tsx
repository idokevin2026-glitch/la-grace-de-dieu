"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/providers/ToastProvider";
import { fcfa, PAYMENTS, STATUS_FLOW, STATUS_LABEL, waLink } from "@/lib/constants";
import type { Order } from "@/lib/types";

export function AdminOrders() {
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    fetch("/api/admin/orders")
      .then((r) => r.json())
      .then((d) => setOrders(d.orders || []))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const advance = async (o: Order) => {
    const res = await fetch(`/api/admin/orders/${o.ref}`, { method: "PATCH" });
    if (!res.ok) {
      toast("Impossible de mettre à jour le statut.", { tone: "gold", icon: "x" });
      return;
    }
    const i = STATUS_FLOW.indexOf(o.status);
    const next = STATUS_FLOW[i + 1];
    toast(`${o.ref} → ${STATUS_LABEL[next]}`, { icon: "check", tone: "green" });
    load();
  };

  if (loading) return null;

  if (orders.length === 0) {
    return (
      <div style={{ background: "var(--paper)", border: "1px dashed var(--line)", borderRadius: 14, padding: 44, textAlign: "center", color: "var(--ink-soft)" }}>
        <div style={{ marginBottom: 10 }}>
          <Icon name="box" size={34} stroke={1.3} />
        </div>
        Aucune commande pour l&apos;instant. Elles apparaîtront ici dès qu&apos;un client commande.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {orders.map((o) => {
        const i = STATUS_FLOW.indexOf(o.status);
        const last = i >= STATUS_FLOW.length - 1;
        return (
          <div key={o.ref} style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 14, padding: 20, boxShadow: "var(--shadow)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontFamily: "var(--font-marcellus),serif", fontSize: 20 }}>
                  {o.ref} <Badge tone={last ? "green" : "gold"} style={{ marginLeft: 8, verticalAlign: "middle" }}>{STATUS_LABEL[o.status]}</Badge>
                </div>
                <div style={{ fontSize: 13.5, color: "var(--ink-soft)", marginTop: 4 }}>
                  {new Date(o.created_at).toLocaleString("fr-FR")} · {o.customer_name} · {o.customer_phone}
                </div>
                <div style={{ fontSize: 13.5, color: "var(--ink-soft)" }}>
                  {o.commune} — {o.address}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 800, fontSize: 18 }}>{fcfa(o.total)}</div>
                <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{PAYMENTS.find((p) => p.id === o.payment_method)?.label}</div>
              </div>
            </div>
            <div style={{ display: "grid", gap: 5, margin: "12px 0", paddingTop: 12, borderTop: "1px solid var(--line)" }}>
              {o.items.map((it, k) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                  <span style={{ color: "var(--ink-soft)" }}>
                    {it.qty} × {it.name} <span style={{ fontSize: 12 }}>({[it.color, it.size].filter(Boolean).join(", ")})</span>
                  </span>
                  <span style={{ fontWeight: 600 }}>{fcfa(it.price * it.qty)}</span>
                </div>
              ))}
            </div>
            {o.measures && (
              <div style={{ fontSize: 13, background: "var(--paper-2)", borderRadius: 8, padding: "9px 12px", marginBottom: 12 }}>
                <strong style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Icon name="ruler" size={14} /> Sur-mesure :
                </strong>{" "}
                {[
                  ["Poitrine", o.measures.poitrine],
                  ["Taille", o.measures.taille],
                  ["Hanches", o.measures.hanches],
                  ["Longueur", o.measures.longueur],
                ]
                  .filter(([, v]) => v)
                  .map(([k, v]) => `${k} ${v}cm`)
                  .join(" · ")}
                {o.measures.note ? ` — ${o.measures.note}` : ""}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <Button variant={last ? "outline" : "dark"} size="sm" onClick={() => advance(o)} disabled={last}>
                {last ? "✓ Commande livrée" : `Marquer « ${STATUS_LABEL[STATUS_FLOW[i + 1]]} »`}
              </Button>
              <a
                href={waLink(`Bonjour ${o.customer_name}, votre commande ${o.ref} chez La Grâce de Dieu : ${STATUS_LABEL[o.status]}.`)}
                target="_blank"
                rel="noopener"
                className="lg-btn"
                style={{ display: "inline-flex", alignItems: "center", gap: 7, borderRadius: 999, fontSize: 13.5, fontWeight: 600, padding: "8px 15px", textDecoration: "none", background: "#25D366", color: "#08341c" }}
              >
                <Icon name="whatsapp" size={15} /> Prévenir le client
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}
