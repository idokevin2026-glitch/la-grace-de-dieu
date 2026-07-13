"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const GREETING: Msg = {
  role: "assistant",
  content:
    "Bonjour et bienvenue chez La Grâce de Dieu ! 👋 Je suis Grâce, votre conseillère. Je peux vous renseigner sur nos pagnes et tenues, les tailles, la livraison à Gagnoa, le paiement ou le Cercle de fidélité. Que puis-je faire pour vous ?",
};

const SUGGESTIONS = ["Quels sont vos nouveaux arrivages ?", "Comment fonctionne la fidélité ?", "Livrez-vous hors de Gagnoa ?"];

export function Assistant() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([GREETING]);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [msgs, busy, open]);

  const send = async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    const next = [...msgs, { role: "user" as const, content: q }];
    setMsgs(next);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      setMsgs((m) => [...m, { role: "assistant", content: data.reply || "Pardon, pouvez-vous reformuler ?" }]);
      if (data.redirectCategory) router.push(data.redirectCategory === "all" ? "/shop" : `/shop?cat=${data.redirectCategory}`);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "Oups, une petite difficulté technique. Réessayez ou appelez le +225 07 08 65 67 30. 🙏" }]);
    }
    setBusy(false);
  };

  return (
    <>
      <button
        className="lg-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label="Assistant La Grâce"
        style={{
          position: "fixed",
          bottom: 22,
          right: 22,
          zIndex: 8000,
          width: 60,
          height: 60,
          borderRadius: 999,
          background: "var(--terracotta)",
          color: "#fff",
          border: "none",
          display: "grid",
          placeItems: "center",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <Icon name={open ? "x" : "chat"} size={26} />
      </button>

      {open && (
        <div
          className="fade-in"
          style={{
            position: "fixed",
            bottom: 94,
            right: 22,
            zIndex: 8000,
            width: "min(380px, calc(100vw - 32px))",
            height: "min(560px, calc(100vh - 130px))",
            background: "var(--paper)",
            borderRadius: 20,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            border: "1px solid var(--line)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <div style={{ position: "relative", overflow: "hidden", background: "var(--ink)", color: "var(--paper)", padding: "16px 18px" }}>
            <div
              className="wax-fill"
              style={{ position: "absolute", inset: 0, opacity: 0.22, ["--pat-bg" as string]: "#3a2c1e", ["--pat-fg" as string]: "rgba(255,220,170,.6)", ["--pat-fg2" as string]: "rgba(200,140,60,.4)" }}
            />
            <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 999, background: "var(--gold)", color: "var(--ink)", display: "grid", placeItems: "center", fontFamily: "var(--font-marcellus),serif", fontSize: 20, flexShrink: 0 }}>
                G
              </div>
              <div>
                <div style={{ fontFamily: "var(--font-marcellus),serif", fontSize: 18 }}>Grâce · Conseillère</div>
                <div style={{ fontSize: 12, color: "rgba(246,239,227,.75)", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: "#6fcf97", display: "inline-block" }} /> En ligne · répond en quelques secondes
                </div>
              </div>
            </div>
          </div>

          <div ref={scroller} style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12, background: "var(--cream)" }}>
            {msgs.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div
                  style={{
                    maxWidth: "82%",
                    padding: "10px 13px",
                    borderRadius: 14,
                    fontSize: 14.5,
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                    background: m.role === "user" ? "var(--terracotta)" : "var(--paper)",
                    color: m.role === "user" ? "#fff" : "var(--ink)",
                    border: m.role === "user" ? "none" : "1px solid var(--line)",
                    borderBottomRightRadius: m.role === "user" ? 4 : 14,
                    borderBottomLeftRadius: m.role === "user" ? 14 : 4,
                  }}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {busy && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{ padding: "12px 15px", borderRadius: 14, background: "var(--paper)", border: "1px solid var(--line)" }}>
                  <span className="lg-typing">
                    <i></i>
                    <i></i>
                    <i></i>
                  </span>
                </div>
              </div>
            )}
            {msgs.length <= 1 && !busy && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="lg-chip" onClick={() => send(s)} style={{ fontSize: 12.5 }}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ padding: 12, borderTop: "1px solid var(--line)", background: "var(--paper)", display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea
              className="lg-input"
              rows={1}
              value={input}
              placeholder="Écrivez votre question…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              style={{ resize: "none", maxHeight: 90, borderRadius: 12 }}
            />
            <button
              className="lg-btn"
              onClick={() => send()}
              disabled={busy || !input.trim()}
              aria-label="Envoyer"
              style={{ flexShrink: 0, width: 42, height: 42, borderRadius: 12, background: "var(--terracotta)", color: "#fff", border: "none", display: "grid", placeItems: "center", opacity: busy || !input.trim() ? 0.5 : 1 }}
            >
              <Icon name="arrowRight" size={20} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
