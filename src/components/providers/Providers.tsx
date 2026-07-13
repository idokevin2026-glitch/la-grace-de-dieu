"use client";

import { ToastProvider } from "./ToastProvider";
import { AuthProvider } from "./AuthProvider";
import { FavoritesProvider } from "./FavoritesProvider";
import { CartProvider } from "./CartProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <FavoritesProvider>
          <CartProvider>{children}</CartProvider>
        </FavoritesProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
