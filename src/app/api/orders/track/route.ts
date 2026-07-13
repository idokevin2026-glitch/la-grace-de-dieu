import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const ref = request.nextUrl.searchParams.get("ref")?.trim();
  if (!ref) return NextResponse.json({ error: "ref requis" }, { status: 400 });

  const admin = createAdminClient();
  const { data: order, error } = await admin.from("orders").select("*").ilike("ref", ref).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!order) return NextResponse.json({ order: null });

  const [{ data: items }, { data: measures }] = await Promise.all([
    admin.from("order_items").select("*").eq("order_id", order.id),
    admin.from("order_measures").select("*").eq("order_id", order.id).maybeSingle(),
  ]);

  return NextResponse.json({
    order: {
      ref: order.ref,
      status: order.status,
      created_at: order.created_at,
      subtotal: order.subtotal,
      shipping_fee: order.shipping_fee,
      points_used: order.points_used,
      points_earned: order.points_earned,
      total: order.total,
      payment_method: order.payment_method,
      customer_name: order.customer_name,
      commune: order.commune,
      address: order.address,
      items: items || [],
      measures: measures || null,
    },
  });
}
