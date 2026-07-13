import { createClient } from "@/lib/supabase/server";
import { ShopClient } from "@/components/shop/ShopClient";
import { NewsletterBand } from "@/components/layout/NewsletterBand";
import type { Product } from "@/lib/types";

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ cat?: string; filter?: string }> }) {
  const { cat, filter } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
  return (
    <>
      <ShopClient key={`${cat || "all"}-${filter || ""}`} products={(data as Product[]) || []} initialCat={cat || "all"} initialFilterNew={filter === "new"} />
      <NewsletterBand />
    </>
  );
}
