import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "Le fichier doit être une image" }, { status: 400 });

  const ext = file.type === "image/png" ? "png" : "jpg";
  const path = `${admin.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await admin.supabase.storage.from("product-images").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = admin.supabase.storage.from("product-images").getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
