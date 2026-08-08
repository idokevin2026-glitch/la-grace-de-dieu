import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { ClothImage } from "@/components/ui/ClothImage";
import { ProductCard } from "@/components/ui/ProductCard";
import { SectionHead, wrap } from "@/components/ui/Form";
import { NewsletterBand } from "@/components/layout/NewsletterBand";
import { CATEGORIES, TIERS } from "@/lib/constants";
import type { Product } from "@/lib/types";

export default async function HomePage() {
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
  const products = (data as Product[]) || [];
  const news = products.filter((p) => p.is_new).slice(0, 4);
  const featured = products.slice(0, 4);
  const shown = news.length ? news : featured;

  return (
    <div className="fade-in">
      {/* HERO */}
      <section style={{ position: "relative", overflow: "hidden", background: "var(--ink)", color: "var(--paper)" }}>
        <div
          className="wax-fill"
          style={{ position: "absolute", inset: 0, opacity: 0.12, ["--pat-bg" as string]: "#2b2017", ["--pat-fg" as string]: "rgba(255,220,170,.5)", ["--pat-fg2" as string]: "rgba(200,140,60,.35)" }}
        />
        {/* halo chaleureux + profondeur */}
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 90% at 15% 10%, rgba(200,138,74,.28), transparent 55%), radial-gradient(90% 80% at 100% 100%, rgba(116,80,40,.35), transparent 60%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(20,14,9,.35) 0%, transparent 30%, rgba(20,14,9,.55) 100%)" }} />
        <div style={{ ...wrap, position: "relative", padding: "clamp(64px,9vw,116px) 24px", display: "grid", gap: 40, gridTemplateColumns: "1fr", maxWidth: 980 }}>
          <div style={{ maxWidth: 660 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
              <Badge tone="gold">Maison de couture · Gagnoa</Badge>
              <span style={{ flex: 1, maxWidth: 90, height: 1, background: "linear-gradient(90deg, rgba(212,175,110,.7), transparent)" }} />
            </div>
            <h1 style={{ fontSize: "clamp(42px, 7vw, 80px)", lineHeight: 1.0, color: "var(--paper)", letterSpacing: "0.005em" }}>
              L&apos;élégance du pagne,
              <br />
              <span style={{ fontStyle: "italic", color: "var(--gold)" }}>faite à la main.</span>
            </h1>
            <p style={{ fontSize: "clamp(17px,2.2vw,20px)", color: "rgba(246,239,227,.82)", marginTop: 24, maxWidth: 530, lineHeight: 1.6 }}>
              Wax authentiques, tenues sur mesure pour toute la famille. La Grâce de Dieu habille vos plus beaux moments.
            </p>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 36 }}>
              <Link
                href="/shop"
                className="lg-btn"
                style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--terracotta)", color: "#fff", borderRadius: 999, fontWeight: 600, fontSize: 16, padding: "15px 32px", boxShadow: "0 10px 30px -10px rgba(180,95,55,.6)" }}
              >
                Découvrir la boutique <Icon name="arrowRight" size={18} />
              </Link>
              <Link
                href="/shop?cat=pagnes"
                className="lg-btn"
                style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(246,239,227,.06)", color: "var(--paper)", border: "1px solid rgba(246,239,227,.32)", borderRadius: 999, fontWeight: 600, fontSize: 16, padding: "15px 32px", backdropFilter: "blur(4px)" }}
              >
                Voir les pagnes
              </Link>
            </div>
            <div style={{ height: 1, background: "linear-gradient(90deg, rgba(246,239,227,.22), transparent)", margin: "40px 0 0", maxWidth: 520 }} />
            <div style={{ display: "flex", gap: 28, marginTop: 22, flexWrap: "wrap", fontSize: 14 }}>
              {(
                [
                  ["truck", "Livraison Gagnoa 24-48h"],
                  ["sparkle", "Arrivages chaque semaine"],
                  ["star", "Cercle fidélité"],
                ] as const
              ).map(([ic, t]) => (
                <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 9, color: "rgba(246,239,227,.82)" }}>
                  <span style={{ color: "var(--gold)" }}>
                    <Icon name={ic} size={18} />
                  </span>
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section style={{ ...wrap, padding: "70px 24px 20px" }}>
        <SectionHead eyebrow="Nos univers" title="Que cherchez-vous aujourd'hui ?" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginTop: 32 }}>
          {CATEGORIES.map((c) => {
            const sample = products.find((p) => p.category === c.id) || { id: c.id, name: c.label, category: c.id, image_url: null };
            return (
              <Link
                key={c.id}
                href={`/shop?cat=${c.id}`}
                className="lg-btn lg-card-hover"
                style={{ padding: 0, border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden", textAlign: "left", background: "var(--paper)", display: "block" }}
              >
                <div className="hover-zoom">
                  <ClothImage product={sample} ratio="4 / 3" rounded={0} label={false} />
                </div>
                <div style={{ padding: "14px 16px 16px" }}>
                  <div style={{ fontFamily: "var(--font-marcellus), serif", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    {c.label}
                    <span style={{ color: "var(--terracotta)", opacity: 0.9 }}>
                      <Icon name="arrowRight" size={15} />
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 4 }}>{c.tagline}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* NOUVEAUX ARRIVAGES */}
      <section style={{ ...wrap, padding: "56px 24px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <SectionHead eyebrow="Fraîchement arrivés" title="Nouveaux arrivages" />
          <Link href="/shop?filter=new" className="lg-btn" style={{ color: "var(--terracotta)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: "none", padding: "8px 12px" }}>
            Tout voir <Icon name="arrowRight" size={16} />
          </Link>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 20, marginTop: 28 }}>
          {shown.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* FIDELITE */}
      <section style={{ background: "var(--paper-2)", padding: "72px 0" }}>
        <div className="resp2" style={{ ...wrap, display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 48, alignItems: "center" }}>
          <div>
            <SectionHead eyebrow="Cercle La Grâce de Dieu" title="Chaque achat vous rapproche du luxe." />
            <p style={{ color: "var(--ink-soft)", fontSize: 16.5, marginTop: 14 }}>
              Cumulez des points à chaque commande, gravissez les niveaux <strong>Perle</strong>, <strong>Ivoire</strong> et <strong>Or</strong>, et profitez de réductions, de la livraison offerte et de l&apos;accès en avant-première aux arrivages.
            </p>
            <div style={{ display: "flex", gap: 12, marginTop: 26, flexWrap: "wrap" }}>
              <Link href="/account" className="lg-btn" style={{ background: "var(--ink)", color: "var(--paper)", borderRadius: 999, fontWeight: 600, fontSize: 15, padding: "11px 22px" }}>
                Rejoindre le Cercle
              </Link>
              <Link href="/account" className="lg-btn" style={{ background: "transparent", color: "var(--ink)", border: "1px solid var(--line)", borderRadius: 999, fontWeight: 600, fontSize: 15, padding: "11px 22px" }}>
                Voir mes points
              </Link>
            </div>
          </div>
          <div style={{ display: "grid", gap: 14 }}>
            {TIERS.map((t) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 16, background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 14, padding: "16px 18px" }}>
                <div style={{ width: 46, height: 46, borderRadius: 999, display: "grid", placeItems: "center", background: "var(--cream)", color: "var(--terracotta)", flexShrink: 0 }}>
                  <Icon name="star" size={22} />
                </div>
                <div>
                  <div style={{ fontFamily: "var(--font-marcellus),serif", fontSize: 19 }}>
                    {t.label} <span style={{ fontSize: 12.5, color: "var(--ink-soft)", fontFamily: "var(--font-karla)" }}>· dès {t.min} pts</span>
                  </div>
                  <div style={{ fontSize: 13.5, color: "var(--ink-soft)" }}>{t.perk}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <NewsletterBand />
    </div>
  );
}
