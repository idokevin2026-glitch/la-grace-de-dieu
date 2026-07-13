const tones: Record<string, React.CSSProperties> = {
  gold: { background: "var(--gold)", color: "var(--ink)" },
  green: { background: "var(--green)", color: "#fff" },
  terracotta: { background: "var(--terracotta)", color: "#fff" },
  soft: { background: "var(--paper-2)", color: "var(--ink-soft)" },
};

export function Badge({
  children,
  tone = "gold",
  style,
}: {
  children: React.ReactNode;
  tone?: keyof typeof tones;
  style?: React.CSSProperties;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: ".08em",
        textTransform: "uppercase",
        padding: "4px 10px",
        borderRadius: 999,
        ...tones[tone],
        ...style,
      }}
    >
      {children}
    </span>
  );
}
