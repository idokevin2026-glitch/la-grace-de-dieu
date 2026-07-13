import { Icon } from "@/components/ui/Icon";
import { STATUS_STEPS } from "@/lib/constants";

export function OrderTimeline({ status }: { status: string }) {
  const cur = Math.max(0, STATUS_STEPS.findIndex((s) => s.id === status));
  return (
    <div style={{ display: "flex", justifyContent: "space-between", margin: "40px 0", position: "relative" }}>
      <div style={{ position: "absolute", top: 15, left: "12%", right: "12%", height: 2, background: "var(--line)" }} />
      <div
        style={{
          position: "absolute",
          top: 15,
          left: "12%",
          width: `calc(${(cur / (STATUS_STEPS.length - 1)) * 76}%)`,
          height: 2,
          background: "var(--terracotta)",
          transition: "width .5s",
        }}
      />
      {STATUS_STEPS.map((s, i) => {
        const done = i <= cur;
        return (
          <div key={s.id} style={{ position: "relative", flex: 1, textAlign: "center" }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                margin: "0 auto 8px",
                display: "grid",
                placeItems: "center",
                background: done ? "var(--terracotta)" : "var(--paper)",
                color: done ? "#fff" : "var(--ink-soft)",
                border: "2px solid " + (done ? "var(--terracotta)" : "var(--line)"),
              }}
            >
              {done ? <Icon name="check" size={16} /> : i + 1}
            </div>
            <div style={{ fontSize: 12.5, color: done ? "var(--ink)" : "var(--ink-soft)", fontWeight: i === cur ? 700 : 400 }}>{s.label}</div>
          </div>
        );
      })}
    </div>
  );
}
