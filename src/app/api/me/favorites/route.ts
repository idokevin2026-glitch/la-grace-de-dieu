import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";

export async function GET() {
  const ctx = await requireUser();
  if (!ctx) return NextResponse.json({ productIds: [] });
  const { data, error } = await ctx.supabase.from("favorites").select("product_id").eq("user_id", ctx.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ productIds: (data || []).map((f) => f.product_id) });
}

export async function POST(request: NextRequest) {
  const ctx = await requireUser();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { productIds } = await request.json();
  if (!Array.isArray(productIds) || !productIds.length) return NextResponse.json({ ok: true });
  const { error } = await ctx.supabase
    .from("favorites")
    .upsert(productIds.map((id: string) => ({ user_id: ctx.user.id, product_id: id })), { onConflict: "user_id,product_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const ctx = await requireUser();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const productId = request.nextUrl.searchParams.get("productId");
  if (!productId) return NextResponse.json({ error: "productId requis" }, { status: 400 });
  const { error } = await ctx.supabase.from("favorites").delete().eq("user_id", ctx.user.id).eq("product_id", productId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
