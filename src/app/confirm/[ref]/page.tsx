import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { Row, wrap } from "@/components/ui/Form";
import { OrderTimeline } from "@/components/orders/OrderTimeline";
import { fcfa, POINT_VALUE } from "@/lib/constants";

export default async function ConfirmPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("*").ilike("ref", ref).maybeSingle();

  if (!order) {
    return (
      <div style={{ ...wrap, padding: 80, textAlign: "center" }}>
        Commande introuvable.{" "}
        <Link href="/shop" style={{ cursor: "pointer" }}>
          Retour à la boutique
        </Link>
      </div>
    );
  }

  const [{ data: items }, { data: measures }] = await Promise.all([
    admin.from("order_items").select("*").eq("order_id", order.id),
    admin.from("order_measures").select("*").eq("order_id", order.id).maybeSingle(),
  ]);

  const firstName = order.customer_name.split(" ")[0];

  return (
    <div className="fade-in" style={{ ...wrap, maxWidth: 720, padding: "56px 24px 80px", textAlign: "center" }}>
      <div
        style={{
          width: 84,
          height: 84,
          borderRadius: 999,
          background: "var(--green)",
          color: "#fff",
          display: "grid",
          placeItems: "center",
          margin: "0 auto 24px",
          boxShadow: "0 12px 30px -8px oklch(0.5 0.075 150 / .5)",
        }}
      >
        <Icon name="check" size={44} stroke={2.4} />
      </div>
      <Badge tone="green" style={{ marginBottom: 14 }}>
        Commande reçue
      </Badge>
      <h1 style={{ fontSize: "clamp(30px,5vw,44px)" }}>Merci, {firstName} !</h1>
      <p style={{ color: "var(--ink-soft)", fontSize: 17, marginTop: 12 }}>
        Votre commande <strong style={{ color: "var(--ink)" }}>{order.ref}</strong> a bien été enregistrée. Une confirmation vous a été envoyée{order.customer_email ? ` à ${order.customer_email}` : " par téléphone"}.
      </p>

      <OrderTimeline status={order.status} />

      <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 16, padding: 24, textAlign: "left", boxShadow: "var(--shadow)" }}>
        <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
          {(items || []).map((it, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 14.5 }}>
              <span style={{ color: "var(--ink-soft)" }}>
                {it.qty} × {it.name} <span style={{ fontSize: 12 }}>({[it.color, it.size].filter(Boolean).join(", ")})</span>
              </span>
              <span style={{ fontWeight: 600 }}>{fcfa(it.price * it.qty)}</span>
            </div>
          ))}
        </div>
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
          <Row label="Sous-total" value={fcfa(order.subtotal)} />
          <Row label="Frais d'expédition" value={order.shipping_fee === 0 ? "Offerts" : fcfa(order.shipping_fee)} />
          {order.points_used > 0 && <Row label={`Points utilisés (−${order.points_used})`} value={"−" + fcfa(order.points_used * POINT_VALUE)} />}
          <Row label="Total" value={fcfa(order.total)} big />
        </div>
        <div style={{ marginTop: 14, padding: "12px 14px", background: "var(--paper-2)", borderRadius: 10, fontSize: 13.5, display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "space-between" }}>
          <span>
            <strong>Livraison :</strong> {order.commune} — {order.address}
          </span>
          <span style={{ color: "var(--green)", fontWeight: 700 }}>
            <Icon name="sparkle" size={14} /> +{order.points_earned} points
          </span>
        </div>
        {measures && (
          <div style={{ marginTop: 10, padding: "12px 14px", background: "var(--paper-2)", borderRadius: 10, fontSize: 13.5 }}>
            <strong style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Icon name="ruler" size={15} /> Sur-mesure :
            </strong>{" "}
            {[
              ["Poitrine", measures.poitrine],
              ["Taille", measures.taille],
              ["Hanches", measures.hanches],
              ["Longueur", measures.longueur],
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => `${k} ${v}cm`)
              .join(" · ")}
            {measures.note ? ` — ${measures.note}` : ""}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 28, flexWrap: "wrap" }}>
        <Link href="/account" className="lg-btn" style={{ background: "var(--ink)", color: "var(--paper)", borderRadius: 999, fontWeight: 600, fontSize: 15, padding: "11px 22px" }}>
          Voir mes commandes & points
        </Link>
        <Link href={`/track?ref=${order.ref}`} className="lg-btn" style={{ background: "transparent", color: "var(--ink)", border: "1px solid var(--line)", borderRadius: 999, fontWeight: 600, fontSize: 15, padding: "11px 22px" }}>
          Suivre ma commande
        </Link>
        <Link href="/shop" className="lg-btn" style={{ background: "transparent", color: "var(--ink)", border: "1px solid var(--line)", borderRadius: 999, fontWeight: 600, fontSize: 15, padding: "11px 22px" }}>
          Continuer mes achats
        </Link>
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";
