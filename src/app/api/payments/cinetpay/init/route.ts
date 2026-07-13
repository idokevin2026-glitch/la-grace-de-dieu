import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const { ref } = await request.json();
  if (!ref) return NextResponse.json({ error: "ref requis" }, { status: 400 });

  const apiKey = process.env.CINETPAY_API_KEY;
  const siteId = process.env.CINETPAY_SITE_ID;
  if (!apiKey || !siteId) {
    return NextResponse.json({ configured: false });
  }

  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("*").eq("ref", ref).maybeSingle();
  if (!order) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;

  try {
    const res = await fetch("https://api-checkout.cinetpay.com/v2/payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: apiKey,
        site_id: siteId,
        transaction_id: order.ref,
        amount: order.total,
        currency: "XOF",
        description: `Commande ${order.ref} — La Grâce de Dieu`,
        customer_name: order.customer_name,
        customer_phone_number: order.customer_phone,
        notify_url: `${siteUrl}/api/payments/cinetpay/webhook`,
        return_url: `${siteUrl}/confirm/${order.ref}`,
        channels: "ALL",
      }),
    });
    const data = await res.json();
    if (data?.code !== "201" || !data?.data?.payment_url) {
      return NextResponse.json({ configured: true, error: data?.message || "Échec de l'initialisation du paiement" }, { status: 502 });
    }
    return NextResponse.json({ configured: true, paymentUrl: data.data.payment_url });
  } catch {
    return NextResponse.json({ configured: true, error: "CinetPay inaccessible" }, { status: 502 });
  }
}
