import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { KenteRule } from "@/components/ui/KenteRule";
import { wrap } from "@/components/ui/Form";
import { CATEGORIES, COMPANY_ADDRESS, COMPANY_HOURS, WHATSAPP_DISPLAY, waLink } from "@/lib/constants";

export function Footer() {
  return (
    <footer style={{ marginTop: "auto", background: "var(--ink)", color: "rgba(246,239,227,.75)" }}>
      <KenteRule style={{ borderRadius: 0 }} />
      <div style={{ ...wrap, padding: "48px 24px 30px", display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 36 }} className="resp3">
        <div>
          <div style={{ fontFamily: "var(--font-marcellus),serif", fontSize: 28, color: "var(--paper)" }}>La Grâce de Dieu</div>
          <p style={{ maxWidth: 320, marginTop: 12, fontSize: 14.5, lineHeight: 1.6 }}>
            Maison de couture et de pagnes wax à Gagnoa. Nous habillons vos plus beaux moments avec des pièces faites main.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
            {["Wave", "Orange Money", "MTN", "Moov", "Visa"].map((p) => (
              <span key={p} style={{ fontSize: 11.5, border: "1px solid rgba(246,239,227,.25)", borderRadius: 6, padding: "4px 9px" }}>
                {p}
              </span>
            ))}
          </div>
        </div>
        <div>
          <div style={{ color: "var(--gold)", fontSize: 13, letterSpacing: ".12em", textTransform: "uppercase", marginBottom: 14 }}>Boutique</div>
          <div style={{ display: "grid", gap: 9, fontSize: 14.5 }}>
            {CATEGORIES.map((c) => (
              <Link key={c.id} href={`/shop?cat=${c.id}`} style={{ color: "inherit" }}>
                {c.label}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <div style={{ color: "var(--gold)", fontSize: 13, letterSpacing: ".12em", textTransform: "uppercase", marginBottom: 14 }}>Contact</div>
          <div style={{ display: "grid", gap: 9, fontSize: 14.5 }}>
            <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Icon name="phone" size={16} /> {WHATSAPP_DISPLAY}
            </span>
            <a href={waLink("Bonjour La Grâce de Dieu ! J'ai une question.")} target="_blank" rel="noopener" style={{ display: "flex", gap: 8, alignItems: "center", color: "#7be0a3" }}>
              <Icon name="whatsapp" size={16} /> Nous écrire sur WhatsApp
            </a>
            <span style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <Icon name="map" size={16} style={{ flexShrink: 0, marginTop: 2 }} /> <span>{COMPANY_ADDRESS}</span>
            </span>
            <span>{COMPANY_HOURS}</span>
            <Link href="/track" style={{ color: "inherit" }}>
              Suivre ma commande →
            </Link>
            <Link href="/account" style={{ color: "var(--gold)" }}>
              Cercle fidélité →
            </Link>
          </div>
        </div>
      </div>
      <div style={{ ...wrap, padding: "16px 24px 30px", borderTop: "1px solid rgba(246,239,227,.15)", fontSize: 12.5, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <span>© {new Date().getFullYear()} La Grâce de Dieu · Gagnoa, Côte d&apos;Ivoire · Tous droits réservés</span>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <Link href="/legal/mentions" style={{ color: "rgba(246,239,227,.75)" }}>
            Mentions légales
          </Link>
          <Link href="/legal/confidentialite" style={{ color: "rgba(246,239,227,.75)" }}>
            Confidentialité
          </Link>
          <Link href="/legal/cgv" style={{ color: "rgba(246,239,227,.75)" }}>
            CGV
          </Link>
        </div>
      </div>
    </footer>
  );
}
