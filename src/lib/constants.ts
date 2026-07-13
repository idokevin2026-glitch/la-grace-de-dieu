import type { Category, PaymentMethod } from "./types";

export const CATEGORIES: { id: Category; label: string; tagline: string }[] = [
  { id: "pagnes", label: "Pagnes au mètre", tagline: "Wax authentiques, vendus en 6 yards" },
  { id: "femmes", label: "Tenues Femmes", tagline: "Robes, ensembles & boubous" },
  { id: "hommes", label: "Tenues Hommes", tagline: "Boubous, chemises & complets" },
  { id: "enfants", label: "Tenues Enfants", tagline: "Petits élégants en pagne" },
  { id: "accessoires", label: "Accessoires", tagline: "Foulards, sacs & bijoux" },
];

export const SIZES_ADULT = ["S", "M", "L", "XL", "XXL"];
export const SIZES_KID = ["2-4 ans", "4-6 ans", "6-8 ans", "8-10 ans"];

/* --- fidélité : « Cercle La Grâce de Dieu » ---------------------- */
export const POINT_RATE = 1000; // 1 point par tranche de 1 000 FCFA dépensée
export const POINT_VALUE = 100; // 1 point = 100 FCFA de réduction

export interface Tier {
  id: "perle" | "ivoire" | "or";
  label: string;
  min: number;
  perk: string;
  discount: number; // remise permanente, fraction (0, 0.05, 0.10)
  freeShippingGagnoa: boolean;
}

export const TIERS: Tier[] = [
  { id: "perle", label: "Perle", min: 0, perk: "Bienvenue au Cercle La Grâce de Dieu", discount: 0, freeShippingGagnoa: false },
  { id: "ivoire", label: "Ivoire", min: 30, perk: "-5% permanent + livraison Gagnoa offerte", discount: 0.05, freeShippingGagnoa: true },
  { id: "or", label: "Or", min: 90, perk: "-10% + accès aux arrivages en avant-première", discount: 0.1, freeShippingGagnoa: true },
];

export function tierFor(points: number): Tier {
  let t = TIERS[0];
  for (const x of TIERS) if (points >= x.min) t = x;
  return t;
}

export function nextTier(points: number): Tier | null {
  return TIERS.find((t) => t.min > points) ?? null;
}

/* --- livraison ---------------------------------------------------- */
export const COMMUNES = [
  "Gagnoa Centre",
  "Dioulakro",
  "Garahio",
  "Zébré",
  "Commerce",
  "Babré",
  "Kepé",
  "Bruxelles",
  "Biabli",
  "Gnamagui",
  "Autres villes",
];

export function deliveryFee(commune: string, tier: Tier | null): number {
  if (tier && tier.freeShippingGagnoa) return 0; // Ivoire/Or : livraison Gagnoa offerte
  if (!commune) return 1000;
  return commune === "Autres villes" ? 3000 : 1000;
}

/* --- paiement ------------------------------------------------------ */
export const PAYMENTS: { id: PaymentMethod; label: string; hint: string }[] = [
  { id: "wave", label: "Wave", hint: "Paiement instantané" },
  { id: "orange", label: "Orange Money", hint: "#144#" },
  { id: "mtn", label: "MTN MoMo", hint: "Mobile Money" },
  { id: "moov", label: "Moov Money", hint: "Flooz" },
  { id: "card", label: "Carte bancaire", hint: "Visa · Mastercard" },
  { id: "cod", label: "Paiement à la livraison", hint: "Espèces à réception" },
  { id: "transfer", label: "Virement bancaire", hint: "RIB communiqué par email" },
];

/* --- commande -------------------------------------------------------- */
export const STATUS_STEPS: { id: string; label: string }[] = [
  { id: "recue", label: "Commande reçue" },
  { id: "prep", label: "En préparation" },
  { id: "route", label: "En livraison" },
  { id: "livree", label: "Livrée" },
];
export const STATUS_FLOW = ["recue", "prep", "route", "livree"];
export const STATUS_LABEL: Record<string, string> = {
  recue: "Commande reçue",
  prep: "En préparation",
  route: "En livraison",
  livree: "Livrée",
};

/* --- coordonnées de l'entreprise ------------------------------------- */
export const COMPANY_NAME = "La Grâce de Dieu";
export const COMPANY_CITY = "Gagnoa";
export const COMPANY_ADDRESS =
  "La Grâce de Dieu — rue Ottro, en allant vers l'hôpital général, non loin de l'Église des Assemblées de Dieu, Gagnoa, Côte d'Ivoire";
export const COMPANY_HOURS = "Lun–Sam · 9h–19h";
export const WHATSAPP_NUMBER = "2250708656730"; // +225 07 08 65 67 30
export const WHATSAPP_DISPLAY = "+225 07 08 65 67 30";

export function fcfa(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FCFA";
}

export function waLink(message: string): string {
  return "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(message);
}

export function waCartMessage(items: { name: string; qty: number; color: string; size: string; price: number }[], total?: number): string {
  let m = "Bonjour La Grâce de Dieu ! Je souhaite commander :\n";
  items.forEach((it) => {
    m += `• ${it.qty} × ${it.name} (${[it.color, it.size].filter(Boolean).join(", ")}) — ${fcfa(it.price * it.qty)}\n`;
  });
  if (total != null) m += `Total : ${fcfa(total)}\n`;
  m += "Merci de me confirmer la disponibilité.";
  return m;
}

/* --- motif "wax" (placeholder tant qu'aucune photo n'est fournie) ---- */
export const WAX_TONES = [
  { bg: "#c88a4a", fg: "rgba(43,32,23,.26)", fg2: "rgba(255,246,230,.20)" },
  { bg: "#8a9a5b", fg: "rgba(30,34,18,.24)", fg2: "rgba(255,250,235,.20)" },
  { bg: "#a94f34", fg: "rgba(40,18,12,.24)", fg2: "rgba(255,236,220,.22)" },
  { bg: "#4f6b52", fg: "rgba(15,28,18,.26)", fg2: "rgba(240,250,238,.18)" },
  { bg: "#b8873c", fg: "rgba(45,30,10,.24)", fg2: "rgba(255,248,230,.22)" },
  { bg: "#7a4b53", fg: "rgba(35,15,20,.26)", fg2: "rgba(255,235,238,.20)" },
];

export function toneFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return WAX_TONES[h % WAX_TONES.length];
}
