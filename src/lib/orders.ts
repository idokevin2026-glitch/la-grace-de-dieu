export function generateOrderRef(): string {
  const year = new Date().getFullYear();
  const n = Math.floor(1000 + Math.random() * 9000);
  return `LG-${year}-${n}`;
}

/** Retente avec un nouveau numéro en cas de collision (contrainte unique sur `ref`). */
export async function withUniqueRef<T>(attempt: (ref: string) => Promise<T | { conflict: true }>): Promise<T> {
  for (let i = 0; i < 5; i++) {
    const result = await attempt(generateOrderRef());
    if (!(result as { conflict?: boolean }).conflict) return result as T;
  }
  throw new Error("Impossible de générer une référence de commande unique.");
}
