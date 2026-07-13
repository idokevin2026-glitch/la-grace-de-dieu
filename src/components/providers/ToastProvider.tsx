"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { Icon } from "@/components/ui/Icon";

interface ToastOptions {
  title?: string;
  tone?: "green" | "gold";
  icon?: string;
  duration?: number;
}
interface ToastItem extends ToastOptions {
  id: string;
  msg: string;
}

const ToastCtx = createContext<(msg: string, opts?: ToastOptions) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((msg: string, opts: ToastOptions = {}) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((t) => [...t, { id, msg, ...opts }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts.duration || 3600);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9000, display: "flex", flexDirection: "column", gap: 10, maxWidth: 360 }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            className="fade-in"
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 11,
              background: "var(--ink)",
              color: "var(--paper)",
              padding: "13px 16px",
              borderRadius: 12,
              boxShadow: "var(--shadow-lg)",
              fontSize: 14.5,
            }}
          >
            <span style={{ marginTop: 1, color: t.tone === "gold" ? "var(--gold)" : "var(--green)", flexShrink: 0 }}>
              <Icon name={t.icon || "check"} size={18} />
            </span>
            <div>
              {t.title && <div style={{ fontWeight: 700, marginBottom: 2 }}>{t.title}</div>}
              <div style={{ opacity: 0.9 }}>{t.msg}</div>
            </div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
