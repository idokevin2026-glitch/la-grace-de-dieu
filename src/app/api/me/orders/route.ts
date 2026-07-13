import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";

export async function GET() {
  const ctx = await requireUser();
  if (!ctx) return NextResponse.json({ orders: [] });
  const { data: orders, error } = await ctx.supabase.from("orders").select("*").eq("user_id", ctx.user.id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (orders || []).map((o) => o.id);
  const { data: items } = ids.length ? await ctx.supabase.from("order_items").select("*").in("order_id", ids) : { data: [] };

  const withItems = (orders || []).map((o) => ({ ...o, items: (items || []).filter((it) => it.order_id === o.id) }));
  return NextResponse.json({ orders: withItems });
}
