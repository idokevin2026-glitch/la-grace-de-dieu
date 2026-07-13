export const wrap: React.CSSProperties = { maxWidth: 1200, margin: "0 auto", padding: "0 24px", width: "100%" };

export function SectionHead({
  eyebrow,
  title,
  sub,
  center,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  center?: boolean;
}) {
  return (
    <div style={{ textAlign: center ? "center" : "left", maxWidth: center ? 640 : "none", margin: center ? "0 auto" : 0 }}>
      {eyebrow && (
        <div style={{ fontSize: 12.5, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--terracotta)", fontWeight: 700, marginBottom: 10 }}>
          {eyebrow}
        </div>
      )}
      <h2 style={{ fontSize: "clamp(26px, 4vw, 40px)" }}>{title}</h2>
      {sub && <p style={{ color: "var(--ink-soft)", fontSize: 16.5, marginTop: 12, marginBottom: 0 }}>{sub}</p>}
    </div>
  );
}

export function Row({ label, value, big, muted }: { label: string; value: React.ReactNode; big?: boolean; muted?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "5px 0", fontSize: big ? 18 : 15 }}>
      <span style={{ color: "var(--ink-soft)", fontWeight: big ? 700 : 400 }}>{label}</span>
      <span style={{ fontWeight: big ? 800 : 600, color: muted ? "var(--ink-soft)" : "var(--ink)", fontSize: muted ? 13.5 : "inherit" }}>{value}</span>
    </div>
  );
}

export function Panel({ title, step, children }: { title: string; step: string; children: React.ReactNode }) {
  return (
    <section style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 16, padding: 22, boxShadow: "var(--shadow)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            background: "var(--ink)",
            color: "var(--paper)",
            display: "grid",
            placeItems: "center",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          {step}
        </span>
        <h3 style={{ fontSize: 20 }}>{title}</h3>
      </div>
      <div style={{ display: "grid", gap: 14 }}>{children}</div>
    </section>
  );
}

export function Field({ label, err, children }: { label: string; err?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="lg-label">{label}</label>
      {children}
      {err && <div style={{ color: "var(--terracotta-deep)", fontSize: 12.5, marginTop: 5 }}>{err}</div>}
    </div>
  );
}
