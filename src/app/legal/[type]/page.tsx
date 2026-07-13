import Link from "next/link";
import { SectionHead, wrap } from "@/components/ui/Form";
import { NewsletterBand } from "@/components/layout/NewsletterBand";
import { LEGAL_DOCS } from "@/lib/legal-docs";

export default async function LegalPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const doc = LEGAL_DOCS[type] || LEGAL_DOCS.mentions;

  return (
    <>
    <div className="fade-in" style={{ ...wrap, maxWidth: 780, padding: "48px 24px 90px" }}>
      <SectionHead eyebrow={doc.eyebrow} title={doc.title} />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "22px 0 30px" }}>
        {(
          [
            ["mentions", "Mentions légales"],
            ["confidentialite", "Confidentialité"],
            ["cgv", "CGV"],
          ] as const
        ).map(([id, l]) => (
          <Link key={id} href={`/legal/${id}`} className="lg-chip" data-on={(type || "mentions") === id}>
            {l}
          </Link>
        ))}
      </div>
      <div style={{ display: "grid", gap: 22 }}>
        {doc.sections.map(([h, body], i) => (
          <section key={i} style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 14, padding: "20px 22px" }}>
            <h3 style={{ fontSize: 19, marginBottom: 8 }}>{h}</h3>
            <p style={{ color: "var(--ink-soft)", fontSize: 15.5, margin: 0, lineHeight: 1.6 }}>{body}</p>
          </section>
        ))}
      </div>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 24 }}>
        Dernière mise à jour : {new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}. Pour toute question : +225 07 08 65 67 30.
      </p>
    </div>
    <NewsletterBand />
    </>
  );
}
