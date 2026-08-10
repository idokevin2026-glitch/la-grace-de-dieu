"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";

/**
 * Outil de cadrage : l'utilisateur zoome et déplace la photo dans un cadre
 * portrait (par défaut 3/4, comme les fiches produit), puis valide. Le résultat
 * est un JPEG déjà dimensionné, prêt à l'envoi — pas besoin de re-redimensionner.
 */
export function ImageCropper({
  file,
  aspect = 3 / 4, // largeur / hauteur
  onDone,
  onCancel,
}: {
  file: File;
  aspect?: number;
  onDone: (blob: Blob) => void;
  onCancel: () => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const [url, setUrl] = useState<string>("");
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [viewW, setViewW] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [working, setWorking] = useState(false);

  const viewH = viewW / aspect;

  // Charge le fichier en image
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    const im = new Image();
    im.onload = () => setNat({ w: im.naturalWidth, h: im.naturalHeight });
    im.src = u;
    imgRef.current = im;
    return () => URL.revokeObjectURL(u);
  }, [file]);

  // Mesure la taille du cadre à l'écran
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => setViewW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const coverScale = nat && viewW ? Math.max(viewW / nat.w, viewH / nat.h) : 1;
  const containScale = nat && viewW ? Math.min(viewW / nat.w, viewH / nat.h) : 1;
  // zoom = 1 correspond à « remplir le cadre » ; on autorise à dézoomer jusqu'à voir toute la photo.
  const minZoom = coverScale ? Math.min(1, containScale / coverScale) : 1;
  const dw = nat ? nat.w * coverScale * zoom : 0;
  const dh = nat ? nat.h * coverScale * zoom : 0;

  // Déplacement libre : la photo peut aller d'un bord à l'autre du cadre
  // (avec du blanc si elle est plus petite que le cadre dans un sens).
  const clampPan = useCallback(
    (x: number, y: number, z: number) => {
      if (!nat || !viewW) return { x: 0, y: 0 };
      const w = nat.w * coverScale * z;
      const h = nat.h * coverScale * z;
      const maxX = Math.abs(w - viewW) / 2;
      const maxY = Math.abs(h - viewH) / 2;
      return {
        x: Math.max(-maxX, Math.min(maxX, x)),
        y: Math.max(-maxY, Math.min(maxY, y)),
      };
    },
    [nat, viewW, viewH, coverScale]
  );

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const nx = drag.current.px + (e.clientX - drag.current.x);
    const ny = drag.current.py + (e.clientY - drag.current.y);
    setPan(clampPan(nx, ny, zoom));
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const onZoom = (z: number) => {
    setZoom(z);
    setPan((p) => clampPan(p.x, p.y, z));
  };

  const validate = () => {
    if (!nat || !viewW || !imgRef.current) return;
    setWorking(true);
    const OUT_W = 1200;
    const OUT_H = Math.round(OUT_W / aspect);
    const k = OUT_W / viewW;
    const imgLeft = viewW / 2 + pan.x - dw / 2;
    const imgTop = viewH / 2 + pan.y - dh / 2;

    const canvas = document.createElement("canvas");
    canvas.width = OUT_W;
    canvas.height = OUT_H;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, OUT_W, OUT_H);
    ctx.drawImage(imgRef.current, imgLeft * k, imgTop * k, dw * k, dh * k);
    canvas.toBlob(
      (blob) => {
        setWorking(false);
        if (blob) onDone(blob);
      },
      "image/jpeg",
      0.85
    );
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(28,20,12,.72)",
        backdropFilter: "blur(4px)",
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
      onClick={onCancel}
    >
      <div
        className="fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 420, background: "var(--paper)", borderRadius: 18, padding: 20, boxShadow: "var(--shadow-lg)" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ color: "var(--terracotta)" }}>
            <Icon name="upload" size={20} />
          </span>
          <h3 style={{ fontSize: 19 }}>Cadrer la photo</h3>
        </div>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 14 }}>
          Glissez la photo pour la déplacer et utilisez le curseur pour zoomer.
        </p>

        <div
          ref={viewportRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: String(aspect),
            overflow: "hidden",
            borderRadius: 12,
            background: "#fff",
            cursor: "grab",
            touchAction: "none",
            userSelect: "none",
          }}
        >
          {url && nat && viewW > 0 && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt="cadrage"
              draggable={false}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: dw,
                height: dh,
                maxWidth: "none",
                transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px)`,
                pointerEvents: "none",
              }}
            />
          )}
          {/* repères de cadrage (règle des tiers) */}
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.5)" }}>
            <div style={{ position: "absolute", left: "33.33%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,.25)" }} />
            <div style={{ position: "absolute", left: "66.66%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,.25)" }} />
            <div style={{ position: "absolute", top: "33.33%", left: 0, right: 0, height: 1, background: "rgba(255,255,255,.25)" }} />
            <div style={{ position: "absolute", top: "66.66%", left: 0, right: 0, height: 1, background: "rgba(255,255,255,.25)" }} />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0 18px" }}>
          <Icon name="search" size={16} />
          <input
            type="range"
            min={minZoom}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => onZoom(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: "var(--terracotta)", cursor: "pointer" }}
            aria-label="Zoom"
          />
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="outline" onClick={onCancel} disabled={working} style={{ flex: 1 }}>
            Annuler
          </Button>
          <Button variant="primary" onClick={validate} disabled={working || !nat} style={{ flex: 1 }}>
            {working ? "Traitement…" : "Valider le cadrage"}
          </Button>
        </div>
      </div>
    </div>
  );
}
