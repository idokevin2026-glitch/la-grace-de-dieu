"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";

const LS_KEY = "lagrace_favorites_v1";

interface FavoritesCtxValue {
  ids: string[];
  toggle: (productId: string) => void;
  has: (productId: string) => boolean;
}

const FavoritesCtx = createContext<FavoritesCtxValue>({ ids: [], toggle: () => {}, has: () => false });
export const useFavorites = () => useContext(FavoritesCtx);

function readLocal(): string[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function writeLocal(ids: string[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [ids, setIds] = useState<string[]>([]);
  const mergedFor = useRef<string | null>(null);

  // invité : favoris en localStorage (lecture impossible pendant le SSR)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!user) setIds(readLocal());
  }, [user]);

  // connexion : fusionner les favoris locaux avec ceux du serveur, une seule fois par session
  useEffect(() => {
    if (!user || mergedFor.current === user.id) return;
    mergedFor.current = user.id;
    const local = readLocal();
    (async () => {
      if (local.length) {
        await fetch("/api/me/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productIds: local }),
        });
        writeLocal([]);
      }
      const res = await fetch("/api/me/favorites");
      if (res.ok) {
        const data = await res.json();
        setIds(data.productIds || []);
      }
    })();
  }, [user]);

  return (
    <FavoritesCtx.Provider
      value={{
        ids,
        has: (productId) => ids.includes(productId),
        toggle: (productId) => {
          const on = ids.includes(productId);
          const next = on ? ids.filter((x) => x !== productId) : [...ids, productId];
          setIds(next);
          if (!user) {
            writeLocal(next);
          } else if (on) {
            fetch(`/api/me/favorites?productId=${productId}`, { method: "DELETE" });
          } else {
            fetch("/api/me/favorites", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ productIds: [productId] }),
            });
          }
        },
      }}
    >
      {children}
    </FavoritesCtx.Provider>
  );
}
