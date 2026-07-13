"use client";

import type { ButtonHTMLAttributes } from "react";

const btnBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  border: "1px solid transparent",
  borderRadius: 999,
  fontWeight: 600,
  fontSize: 15,
  padding: "11px 22px",
  transition: "all .18s ease",
  lineHeight: 1,
  letterSpacing: ".01em",
};

const variants: Record<string, React.CSSProperties> = {
  primary: { background: "var(--terracotta)", color: "#fff" },
  dark: { background: "var(--ink)", color: "var(--paper)" },
  outline: { background: "transparent", color: "var(--ink)", borderColor: "var(--line)" },
  ghost: { background: "transparent", color: "var(--ink)", padding: "8px 12px" },
  gold: { background: "var(--gold)", color: "var(--ink)" },
  whatsapp: { background: "#25D366", color: "#08341c" },
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: "sm" | "lg";
  full?: boolean;
}

export function Button({ variant = "primary", size, full, children, style, className, disabled, ...rest }: ButtonProps) {
  const sizes = size === "sm" ? { padding: "8px 15px", fontSize: 13.5 } : size === "lg" ? { padding: "14px 30px", fontSize: 16 } : {};
  return (
    <button
      {...rest}
      disabled={disabled}
      className={"lg-btn " + (className || "")}
      style={{
        ...btnBase,
        ...variants[variant],
        ...sizes,
        ...(full ? { width: "100%" } : {}),
        ...(disabled ? { opacity: 0.6, cursor: "default" } : {}),
        ...style,
      }}
    >
      {children}
    </button>
  );
}
