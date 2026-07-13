import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, POINT_RATE, POINT_VALUE, TIERS, WHATSAPP_DISPLAY, COMPANY_ADDRESS, COMPANY_HOURS } from "@/lib/constants";
import type { Product } from "@/lib/types";

const FALLBACK_REPLY = `Je suis momentanément indisponible. Pour toute question, appelez-nous au ${WHATSAPP_DISPLAY} (${COMPANY_HOURS}). 🙏`;

function catalogText(products: Product[]) {
  return products
    .map((p) => {
      const cat = CATEGORIES.find((c) => c.id === p.category)?.label ?? p.category;
      return `- ${p.name} | ${cat} | ${p.price} FCFA | coloris: ${p.colors.join(", ")} | tailles: ${p.sizes.join(", ")}${p.is_new ? " | NOUVEAUTÉ" : ""}`;
    })
    .join("\n");
}

function systemPrompt(products: Product[]) {
  return `Tu es « Grâce », la conseillère virtuelle de la boutique en ligne LA GRÂCE DE DIEU, une maison de couture et de pagnes wax basée à Gagnoa, en Côte d'Ivoire.

TON & STYLE :
- Réponds en français par défaut. Si le client écrit en nouchi ou en langue locale, adapte-toi chaleureusement.
- Sois chaleureuse, polie, concise (2 à 5 phrases). Tutoie ou vouvoie selon le ton du client (vouvoiement par défaut).
- Utilise au maximum un emoji occasionnel. Ne sois pas robotique.
- N'invente jamais un produit, un prix ou une promotion qui n'existe pas. Si tu ne sais pas, propose d'appeler le ${WHATSAPP_DISPLAY}.

INFOS BOUTIQUE :
- Catégories : ${CATEGORIES.map((c) => c.label).join(", ")}.
- Prix en FCFA. Confection faite main dans nos ateliers de Gagnoa.
- Livraison : Gagnoa 1 000 FCFA (24-48h), autres villes 3 000 FCFA (3-5 jours). Offerte pour les membres Ivoire et Or.
- Paiement : Wave, Orange Money, MTN MoMo, Moov Money, carte bancaire, paiement à la livraison, virement bancaire.
- Horaires : ${COMPANY_HOURS}. Téléphone : ${WHATSAPP_DISPLAY}. Boutique : ${COMPANY_ADDRESS}.
- Programme de fidélité « Cercle La Grâce » : 1 point par tranche de ${POINT_RATE} FCFA dépensée ; 1 point = ${POINT_VALUE} FCFA de réduction. Niveaux : ${TIERS.map((t) => `${t.label} (dès ${t.min} pts : ${t.perk})`).join(" ; ")}.
- Pour commander : ajouter au panier puis passer commande ; une confirmation « Commande reçue » est envoyée. On peut aussi commander directement sur WhatsApp.
- Suivi de commande : le client peut suivre l'état de sa commande avec son numéro (ex. LG-2026-1234) dans la page « Suivi ».
- Confection sur-mesure possible : le client indique ses mesures (poitrine, taille, hanches, longueur) au moment de la commande.
- Favoris : le client peut enregistrer des articles en cliquant sur le cœur.

CATALOGUE ACTUEL (utilise-le pour recommander et donner les vrais prix) :
${catalogText(products)}

Quand un client cherche un type d'article, utilise l'outil ouvrir_boutique pour l'amener directement à la bonne catégorie.`;
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: "ouvrir_boutique",
    description: "Affiche la boutique filtrée sur une catégorie précise pour aider le client à voir les articles.",
    input_schema: {
      type: "object",
      properties: {
        categorie: {
          type: "string",
          enum: ["all", "pagnes", "femmes", "hommes", "enfants", "accessoires"],
          description: "La catégorie à afficher",
        },
      },
      required: ["categorie"],
    },
  },
];

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ reply: FALLBACK_REPLY });
  }

  const { messages } = await request.json();
  if (!Array.isArray(messages) || !messages.length) {
    return NextResponse.json({ error: "messages requis" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: products } = await supabase.from("products").select("*");

  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
  const system = systemPrompt((products as Product[]) || []);
  const history: Anthropic.MessageParam[] = messages.map((m: { role: string; content: string }) => ({
    role: m.role === "user" ? "user" : "assistant",
    content: m.content,
  }));

  try {
    let response = await client.messages.create({
      model,
      max_tokens: 700,
      system,
      messages: history,
      tools: TOOLS,
      output_config: { effort: "low" },
    });

    let redirectCategory: string | undefined;

    if (response.stop_reason === "tool_use") {
      const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      if (toolUse && toolUse.name === "ouvrir_boutique") {
        const categorie = (toolUse.input as { categorie?: string }).categorie || "all";
        redirectCategory = categorie;
        const label = CATEGORIES.find((c) => c.id === categorie)?.label || "tous les articles";

        response = await client.messages.create({
          model,
          max_tokens: 700,
          system,
          messages: [
            ...history,
            { role: "assistant", content: response.content },
            {
              role: "user",
              content: [
                {
                  type: "tool_result",
                  tool_use_id: toolUse.id,
                  content: `La boutique affiche maintenant : ${label}.`,
                },
              ],
            },
          ],
          tools: TOOLS,
          output_config: { effort: "low" },
        });
      }
    }

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    return NextResponse.json({ reply: textBlock?.text || "Pardon, pouvez-vous reformuler ?", redirectCategory });
  } catch (err) {
    console.warn("Assistant error:", err);
    return NextResponse.json({ reply: `Oups, une petite difficulté technique. Réessayez ou appelez le ${WHATSAPP_DISPLAY}. 🙏` });
  }
}
