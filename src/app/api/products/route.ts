import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = request.nextUrl;
  const category = searchParams.get("category");
  const q = searchParams.get("q");
  const sort = searchParams.get("sort") || "recent";
  const onlyNew = searchParams.get("new") === "true";

  let query = supabase.from("products").select("*");
  if (category && category !== "all") query = query.eq("category", category);
  if (onlyNew) query = query.eq("is_new", true);
  if (q) query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);

  if (sort === "price-asc") query = query.order("price", { ascending: true });
  else if (sort === "price-desc") query = query.order("price", { ascending: false });
  else query = query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: data });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, category, price, colors, sizes, description, is_new, image_url } = body;
  if (!name || !category || typeof price !== "number") {
    return NextResponse.json({ error: "name, category et price sont requis" }, { status: 400 });
  }

  const { data, error } = await admin.supabase
    .from("products")
    .insert({
      name,
      category,
      price,
      colors: colors || [],
      sizes: sizes || [],
      description: description || "",
      is_new: !!is_new,
      image_url: image_url || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ product: data }, { status: 201 });
}
