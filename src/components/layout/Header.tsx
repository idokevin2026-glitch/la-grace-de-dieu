"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { wrap } from "@/components/ui/Form";
import { useCart } from "@/components/providers/CartProvider";
import { useFavorites } from "@/components/providers/FavoritesProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import type { Notification } from "@/lib/types";

const LINKS: [string, string][] = [
  ["/", "Accueil"],
  ["/shop", "Boutique"],
  ["/track", "Suivi"],
  ["/account", "Fidélité"],
  ["/admin", "Admin"],
];

function timeAgo(t: string) {
  const s = Math.floor((Date.now() - new Date(t).getTime()) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return Math.floor(s / 60) + " min";
  if (s < 86400) return Math.floor(s / 3600) + " h";
  return new Date(t).toLocaleDateString("fr-FR");
}

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { count } = useCart();
  const { ids: favIds } = useFavorites();
  const { user } = useAuth();
  const [notifOpen, setNotifOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const unread = notifs.filter((n) => !n.read).length;

  useEffect(() => {
    // Syncs the notification list to the current auth user, sourced from the server — not derivable from render.
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotifs([]);
      return;
    }
    fetch("/api/me/notifications")
      .then((r) => (r.ok ? r.json() : { notifications: [] }))
      .then((d) => setNotifs(d.notifications || []))
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMenuOpen(false);
  }, [pathname]);

  const markRead = () => {
    if (!unread) return;
    setTimeout(() => {
      fetch("/api/me/notifications", { method: "PATCH" });
      setNotifs((n) => n.map((x) => ({ ...x, read: true })));
    }, 1200);
  };

  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 500,
        background: "rgba(246,239,227,.9)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div style={{ ...wrap, display: "flex", alignItems: "center", gap: 20, height: 68 }}>
        <Link
          href="/"
          className="lg-btn"
          style={{ background: "none", border: "none", padding: 0, display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1 }}
        >
          <span style={{ fontFamily: "var(--font-marcellus),serif", fontSize: "clamp(19px, 5vw, 23px)", letterSpacing: ".03em", color: "var(--ink)", lineHeight: 1, whiteSpace: "nowrap" }}>
            La Grâce de Dieu
          </span>
          <span style={{ fontSize: 9.5, letterSpacing: ".38em", textTransform: "uppercase", color: "var(--terracotta)", marginLeft: 2 }}>Gagnoa</span>
        </Link>

        <nav className="lg-nav-desk" style={{ display: "flex", gap: 4, marginLeft: 12 }}>
          {LINKS.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="lg-btn"
              style={{
                background: "none",
                border: "none",
                padding: "8px 14px",
                borderRadius: 999,
                fontSize: 15,
                fontWeight: active(href) ? 700 : 500,
                color: active(href) ? "var(--terracotta)" : "var(--ink)",
              }}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", alignItems: "center", gap: 4 }} ref={ref}>
          <div style={{ position: "relative" }}>
            <IconBtn
              label="notifications"
              onClick={() => {
                setNotifOpen((v) => !v);
                if (!notifOpen) markRead();
              }}
            >
              <Icon name="bell" size={21} />
              {unread > 0 && <Dot />}
            </IconBtn>
            {notifOpen && (
              <div
                className="fade-in"
                style={{
                  position: "absolute",
                  right: 0,
                  top: 46,
                  width: 320,
                  background: "var(--paper)",
                  border: "1px solid var(--line)",
                  borderRadius: 14,
                  boxShadow: "var(--shadow-lg)",
                  overflow: "hidden",
                }}
              >
                <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--line)", fontWeight: 700 }}>Notifications</div>
                <div style={{ maxHeight: 320, overflow: "auto" }}>
                  {!user ? (
                    <div style={{ padding: "26px 16px", textAlign: "center", color: "var(--ink-soft)", fontSize: 14 }}>
                      Connectez-vous pour voir vos notifications.
                    </div>
                  ) : notifs.length === 0 ? (
                    <div style={{ padding: "26px 16px", textAlign: "center", color: "var(--ink-soft)", fontSize: 14 }}>Aucune notification pour l&apos;instant.</div>
                  ) : (
                    notifs.map((n) => (
                      <button
                        key={n.id}
                        className="lg-btn"
                        onClick={() => {
                          if (n.order_ref) router.push(`/confirm/${n.order_ref}`);
                          setNotifOpen(false);
                        }}
                        style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: "1px solid var(--line)", padding: "13px 16px" }}
                      >
                        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                          <span style={{ color: "var(--green)", marginTop: 1 }}>
                            <Icon name="check" size={17} />
                          </span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>{n.title}</div>
                            <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 2 }}>{n.body}</div>
                            <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 4 }}>{timeAgo(n.created_at)}</div>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div style={{ position: "relative" }}>
            <IconBtn label="favoris" onClick={() => router.push("/favorites")}>
              <Icon name="heart" size={21} />
              {favIds.length > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: 2,
                    right: 2,
                    background: "var(--gold)",
                    color: "var(--ink)",
                    fontSize: 10.5,
                    fontWeight: 700,
                    minWidth: 17,
                    height: 17,
                    borderRadius: 999,
                    display: "grid",
                    placeItems: "center",
                    padding: "0 4px",
                  }}
                >
                  {favIds.length}
                </span>
              )}
            </IconBtn>
          </div>

          <IconBtn label="compte" onClick={() => router.push("/account")}>
            <Icon name="user" size={21} />
          </IconBtn>

          <div style={{ position: "relative" }}>
            <IconBtn label="panier" onClick={() => router.push("/cart")}>
              <Icon name="bag" size={21} />
              {count > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: 2,
                    right: 2,
                    background: "var(--terracotta)",
                    color: "#fff",
                    fontSize: 10.5,
                    fontWeight: 700,
                    minWidth: 17,
                    height: 17,
                    borderRadius: 999,
                    display: "grid",
                    placeItems: "center",
                    padding: "0 4px",
                  }}
                >
                  {count}
                </span>
              )}
            </IconBtn>
          </div>

          <button className="lg-btn lg-nav-mob" onClick={() => setMenuOpen((v) => !v)} style={{ background: "none", border: "none", padding: 8 }} aria-label="menu">
            <Icon name={menuOpen ? "x" : "grid"} size={22} />
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="lg-nav-mob fade-in" style={{ borderTop: "1px solid var(--line)", background: "var(--paper)" }}>
          <div style={{ ...wrap, padding: "10px 24px 16px", display: "grid", gap: 2 }}>
            {LINKS.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="lg-btn"
                style={{ background: "none", border: "none", textAlign: "left", padding: "12px 6px", fontSize: 17, fontWeight: active(href) ? 700 : 500, color: active(href) ? "var(--terracotta)" : "var(--ink)", borderBottom: "1px solid var(--line)" }}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}

const IconBtn = ({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) => (
  <button
    className="lg-btn"
    onClick={onClick}
    aria-label={label}
    style={{ position: "relative", background: "none", border: "none", width: 42, height: 42, borderRadius: 999, display: "grid", placeItems: "center", color: "var(--ink)" }}
  >
    {children}
  </button>
);
const Dot = () => <span style={{ position: "absolute", top: 8, right: 9, width: 8, height: 8, background: "var(--terracotta)", borderRadius: 999, border: "2px solid var(--cream)" }} />;
