import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { STATUS_FLOW, STATUS_LABEL } from "@/lib/constants";
import { sendWhatsAppText, orderStatusMessage } from "@/lib/whatsapp";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ ref: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { ref } = await params;

  const { data: order } = await admin.supabase.from("orders").select("*").eq("ref", ref).maybeSingle();
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const i = STATUS_FLOW.indexOf(order.status);
  const nextStatus: string = body.status || STATUS_FLOW[Math.min(i + 1, STATUS_FLOW.length - 1)];
  if (!STATUS_FLOW.includes(nextStatus)) return NextResponse.json({ error: "statut invalide" }, { status: 400 });

  const { data: updated, error } = await admin.supabase.from("orders").update({ status: nextStatus }).eq("ref", ref).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (order.user_id) {
    await admin.supabase.from("notifications").insert({
      user_id: order.user_id,
      type: "order",
      title: `Commande ${STATUS_LABEL[nextStatus]}`,
      body: `Votre commande ${ref} : ${STATUS_LABEL[nextStatus]}.`,
      order_ref: ref,
    });
  }
  sendWhatsAppText(order.customer_phone, orderStatusMessage(order.customer_name, ref, STATUS_LABEL[nextStatus])).catch(() => {});

  return NextResponse.json({ order: updated });
}
