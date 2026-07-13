import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deliveryFee, fcfa, tierFor, POINT_RATE, POINT_VALUE, PAYMENTS, COMMUNES } from "@/lib/constants";
import { withUniqueRef } from "@/lib/orders";
import { sendWhatsAppText, orderReceivedMessage } from "@/lib/whatsapp";

interface OrderItemInput {
  productId: string;
  size: string;
  color: string;
  qty: number;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const items: OrderItemInput[] = Array.isArray(body.items) ? body.items : [];
  const customer = body.customer || {};
  const paymentMethod: string = body.payment;
  const usePoints = !!body.usePoints;
  const measures = body.measures || null;

  if (!items.length) return NextResponse.json({ error: "Panier vide" }, { status: 400 });
  if (!customer.name?.trim()) return NextResponse.json({ error: "Nom requis" }, { status: 400 });
  if (!/^[0-9 +]{8,}$/.test(String(customer.phone || "").trim())) return NextResponse.json({ error: "Téléphone invalide" }, { status: 400 });
  if (!customer.commune || !COMMUNES.includes(customer.commune)) return NextResponse.json({ error: "Zone de livraison invalide" }, { status: 400 });
  if (!customer.address?.trim()) return NextResponse.json({ error: "Adresse requise" }, { status: 400 });
  if (!PAYMENTS.some((p) => p.id === paymentMethod)) return NextResponse.json({ error: "Moyen de paiement invalide" }, { status: 400 });

  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();

  const admin = createAdminClient();

  // recalcul serveur : jamais confiance dans les prix envoyés par le client
  const productIds = [...new Set(items.map((it) => it.productId))];
  const { data: products, error: productsErr } = await admin.from("products").select("*").in("id", productIds);
  if (productsErr) return NextResponse.json({ error: productsErr.message }, { status: 500 });

  const byId = new Map((products || []).map((p) => [p.id, p]));
  const lineItems = items.map((it) => {
    const product = byId.get(it.productId);
    if (!product) throw new Error("Article introuvable : " + it.productId);
    return {
      product_id: product.id,
      name: product.name as string,
      price: product.price as number,
      qty: Math.max(1, it.qty | 0),
      size: it.size || null,
      color: it.color || null,
    };
  });

  let profile: { id: string; points: number } | null = null;
  if (user) {
    const { data } = await admin.from("profiles").select("id, points").eq("id", user.id).maybeSingle();
    profile = data;
  }
  const tier = tierFor(profile?.points ?? 0);

  const subtotal = lineItems.reduce((s, it) => s + it.price * it.qty, 0);
  const shippingFee = deliveryFee(customer.commune, tier);
  const redeemPts = usePoints && profile ? Math.floor(Math.min(profile.points, Math.floor((subtotal * 0.5) / POINT_VALUE))) : 0;
  const redeemValue = redeemPts * POINT_VALUE;
  const total = Math.max(0, subtotal + shippingFee - redeemValue);
  const pointsEarned = Math.floor(subtotal / POINT_RATE);

  try {
    const order = await withUniqueRef(async (ref) => {
      const { data, error } = await admin
        .from("orders")
        .insert({
          ref,
          user_id: user?.id ?? null,
          status: "recue",
          subtotal,
          shipping_fee: shippingFee,
          points_used: redeemPts,
          points_earned: pointsEarned,
          total,
          payment_method: paymentMethod,
          payment_status: "pending",
          customer_name: customer.name.trim(),
          customer_phone: customer.phone.trim(),
          customer_email: customer.email?.trim() || null,
          commune: customer.commune,
          address: customer.address.trim(),
          note: customer.note?.trim() || null,
        })
        .select()
        .single();
      if (error) {
        if (error.code === "23505") return { conflict: true } as const;
        throw error;
      }
      return data;
    });

    await admin.from("order_items").insert(lineItems.map((it) => ({ ...it, order_id: order.id })));

    if (measures && Object.values(measures).some((v) => v)) {
      await admin.from("order_measures").insert({
        order_id: order.id,
        poitrine: measures.poitrine ? Number(measures.poitrine) : null,
        taille: measures.taille ? Number(measures.taille) : null,
        hanches: measures.hanches ? Number(measures.hanches) : null,
        longueur: measures.longueur ? Number(measures.longueur) : null,
        note: measures.note || null,
      });
    }

    if (profile) {
      await admin
        .from("profiles")
        .update({ points: profile.points + pointsEarned - redeemPts })
        .eq("id", profile.id);
    }

    if (user) {
      await admin.from("notifications").insert({
        user_id: user.id,
        type: "order",
        title: "Commande reçue ✓",
        body: `Votre commande ${order.ref} de ${fcfa(total)} a bien été enregistrée.`,
        order_ref: order.ref,
      });
    }

    // meilleur effort — ne bloque jamais la commande si WhatsApp n'est pas configuré
    sendWhatsAppText(customer.phone, orderReceivedMessage(order.ref, fcfa(total))).catch(() => {});

    return NextResponse.json({ ref: order.ref, total, pointsEarned }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erreur serveur" }, { status: 500 });
  }
}
