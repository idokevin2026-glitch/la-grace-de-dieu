import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProductDetail } from "@/components/shop/ProductDetail";
import { NewsletterBand } from "@/components/layout/NewsletterBand";
import { wrap } from "@/components/ui/Form";
import type { Product } from "@/lib/types";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: product } = await supabase.from("products").select("*").eq("id", id).maybeSingle();

  if (!product) {
    return (
      <div style={{ ...wrap, padding: 80, textAlign: "center" }}>
        Article introuvable.{" "}
        <Link href="/shop" style={{ cursor: "pointer" }}>
          Retour à la boutique
        </Link>
      </div>
    );
  }

  const { data: related } = await supabase.from("products").select("*").eq("category", product.category).neq("id", id).limit(4);

  return (
    <>
      <ProductDetail key={id} product={product as Product} related={(related as Product[]) || []} />
      <NewsletterBand />
    </>
  );
}


export const dynamic = "force-dynamic";
