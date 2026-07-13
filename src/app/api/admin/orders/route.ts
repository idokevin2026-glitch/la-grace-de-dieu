import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: orders, error } = await admin.supabase.from("orders").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (orders || []).map((o) => o.id);
  const [{ data: items }, { data: measures }] = await Promise.all([
    ids.length ? admin.supabase.from("order_items").select("*").in("order_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? admin.supabase.from("order_measures").select("*").in("order_id", ids) : Promise.resolve({ data: [] }),
  ]);

  const withDetails = (orders || []).map((o) => ({
    ...o,
    items: (items || []).filter((it) => it.order_id === o.id),
    measures: (measures || []).find((m) => m.order_id === o.id) || null,
  }));

  return NextResponse.json({ orders: withDetails });
}
