import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";

export async function GET() {
  const ctx = await requireUser();
  if (!ctx) return NextResponse.json({ notifications: [] });
  const { data, error } = await ctx.supabase
    .from("notifications")
    .select("*")
    .eq("user_id", ctx.user.id)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notifications: data || [] });
}

export async function PATCH() {
  const ctx = await requireUser();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { error } = await ctx.supabase.from("notifications").update({ read: true }).eq("user_id", ctx.user.id).eq("read", false);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
