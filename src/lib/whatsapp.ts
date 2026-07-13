/**
 * Notifications WhatsApp automatiques via WhatsApp Cloud API.
 * Si WHATSAPP_CLOUD_TOKEN / WHATSAPP_PHONE_NUMBER_ID ne sont pas configurés, la fonction
 * est un no-op silencieux : les liens wa.me manuels (bouton "Prévenir le client") restent
 * la voie de repli fonctionnelle sans configuration.
 */
export async function sendWhatsAppText(toE164: string, body: string): Promise<{ ok: boolean; reason?: string }> {
  const token = process.env.WHATSAPP_CLOUD_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return { ok: false, reason: "not_configured" };

  const to = toE164.replace(/[^\d]/g, "");
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body },
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.warn("WhatsApp Cloud API error:", detail);
      return { ok: false, reason: "api_error" };
    }
    return { ok: true };
  } catch (err) {
    console.warn("WhatsApp Cloud API unreachable:", err);
    return { ok: false, reason: "network_error" };
  }
}

export function orderReceivedMessage(ref: string, total: string) {
  return `Bonjour, votre commande ${ref} de ${total} chez La Grâce de Dieu a bien été enregistrée. Nous vous recontactons rapidement. Merci de votre confiance ! 🙏`;
}

export function orderStatusMessage(name: string, ref: string, statusLabel: string) {
  return `Bonjour ${name}, votre commande ${ref} chez La Grâce de Dieu : ${statusLabel}.`;
}
