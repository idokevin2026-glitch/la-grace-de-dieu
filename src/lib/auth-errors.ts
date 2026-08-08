/** Traduit les messages d'erreur d'authentification Supabase en français lisible. */
export function frAuthError(message?: string): string {
  const m = (message || "").toLowerCase();
  if (m.includes("invalid login credentials"))
    return "Email ou mot de passe incorrect. Si vous n'avez pas encore de compte, créez-en un avec l'onglet « Créer un compte ».";
  if (m.includes("email not confirmed"))
    return "Votre email n'est pas encore confirmé. Ouvrez le message reçu dans votre boîte mail et cliquez sur le lien de confirmation.";
  if (m.includes("user already registered") || m.includes("already been registered"))
    return "Un compte existe déjà avec cet email. Utilisez l'onglet « J'ai déjà un compte ».";
  if (m.includes("password") && m.includes("6"))
    return "Le mot de passe doit contenir au moins 6 caractères.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Trop de tentatives. Patientez une minute puis réessayez.";
  if (m.includes("unable to validate email") || m.includes("invalid email"))
    return "L'adresse email n'est pas valide.";
  return message || "Une erreur est survenue. Réessayez.";
}
