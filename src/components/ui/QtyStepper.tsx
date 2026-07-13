"use client";

import { Icon } from "./Icon";

export function QtyStepper({ value, onChange, min = 1 }: { value: number; onChange: (v: number) => void; min?: number }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", border: "1px solid var(--line)", borderRadius: 999, background: "var(--paper)" }}>
      <button
        className="lg-btn"
        onClick={() => onChange(Math.max(min, value - 1))}
        style={{ background: "none", border: "none", padding: "8px 12px", color: "var(--ink)" }}
        aria-label="moins"
        type="button"
      >
        <Icon name="minus" size={16} />
      </button>
      <span style={{ minWidth: 24, textAlign: "center", fontWeight: 700 }}>{value}</span>
      <button
        className="lg-btn"
        onClick={() => onChange(value + 1)}
        style={{ background: "none", border: "none", padding: "8px 12px", color: "var(--ink)" }}
        aria-label="plus"
        type="button"
      >
        <Icon name="plus" size={16} />
      </button>
    </div>
  );
}
