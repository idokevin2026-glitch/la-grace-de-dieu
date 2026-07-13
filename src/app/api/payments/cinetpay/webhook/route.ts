import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Webhook CinetPay. Ne jamais se fier au seul contenu du callback : on revérifie
 * systématiquement le statut auprès de l'API CinetPay avant de marquer une commande payée.
 */
export async function POST(request: NextRequest) {
  const apiKey = process.env.CINETPAY_API_KEY;
  const siteId = process.env.CINETPAY_SITE_ID;
  if (!apiKey || !siteId) return NextResponse.json({ ok: false }, { status: 503 });

  let transactionId: string | undefined;
  const contentType = request.headers.get("content-type") || "";
  try {
    if (contentType.includes("application/json")) {
      const body = await request.json();
      transactionId = body.cpm_trans_id || body.transaction_id;
    } else {
      const form = await request.formData();
      transactionId = (form.get("cpm_trans_id") || form.get("transaction_id"))?.toString();
    }
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!transactionId) return NextResponse.json({ ok: false }, { status: 400 });

  const checkRes = await fetch("https://api-checkout.cinetpay.com/v2/payment/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apikey: apiKey, site_id: siteId, transaction_id: transactionId }),
  });
  const check = await checkRes.json();
  const paid = check?.data?.status === "ACCEPTED";

  const admin = createAdminClient();
  await admin
    .from("orders")
    .update({ payment_status: paid ? "paid" : "failed" })
    .eq("ref", transactionId);

  return NextResponse.json({ ok: true });
}
