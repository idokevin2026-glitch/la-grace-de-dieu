"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { CartItem, Product } from "@/lib/types";

const LS_KEY = "lagrace_cart_v1";

interface CartCtxValue {
  items: CartItem[];
  count: number;
  subtotal: number;
  add: (product: Product, size: string, color: string, qty: number) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
}

const CartCtx = createContext<CartCtxValue | null>(null);
export const useCart = () => {
  const ctx = useContext(CartCtx);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // localStorage is unavailable during SSR, so the cart can only be restored post-mount.
    try {
      const raw = localStorage.getItem(LS_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setItems(JSON.parse(raw));
    } catch {
      /* ignore corrupted storage */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(items));
    } catch {
      /* quota exceeded — ignore */
    }
  }, [items, hydrated]);

  const value = useMemo<CartCtxValue>(() => {
    const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
    const count = items.reduce((s, it) => s + it.qty, 0);
    return {
      items,
      count,
      subtotal,
      add: (product, size, color, qty) => {
        const key = product.id + "|" + size + "|" + color;
        setItems((cur) => {
          const found = cur.find((c) => c.key === key);
          if (found) return cur.map((c) => (c.key === key ? { ...c, qty: c.qty + qty } : c));
          return [
            ...cur,
            {
              key,
              productId: product.id,
              name: product.name,
              price: product.price,
              image: product.image_url,
              category: product.category,
              size,
              color,
              qty,
            },
          ];
        });
      },
      setQty: (key, qty) => setItems((cur) => cur.map((c) => (c.key === key ? { ...c, qty } : c)).filter((c) => c.qty > 0)),
      remove: (key) => setItems((cur) => cur.filter((c) => c.key !== key)),
      clear: () => setItems([]),
    };
  }, [items]);

  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}
