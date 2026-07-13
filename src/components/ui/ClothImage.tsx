import { toneFor } from "@/lib/constants";

interface ClothImageProps {
  product: { id: string; name: string; category: string; image_url: string | null };
  ratio?: string;
  rounded?: number;
  label?: boolean;
}

export function ClothImage({ product, ratio = "3 / 4", rounded = 12, label = true }: ClothImageProps) {
  const tone = toneFor(product.id + product.name);
  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: ratio, borderRadius: rounded, overflow: "hidden", background: "var(--paper-2)" }}>
      {product.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URLs, dataURL previews
        <img src={product.image_url} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <div
          className="wax-fill"
          style={
            {
              position: "absolute",
              inset: 0,
              "--pat-bg": tone.bg,
              "--pat-fg": tone.fg,
              "--pat-fg2": tone.fg2,
              display: "flex",
              alignItems: "flex-end",
              padding: 12,
            } as React.CSSProperties
          }
        >
          {label && (
            <span
              style={{
                position: "relative",
                fontFamily: "monospace",
                fontSize: 11,
                letterSpacing: ".04em",
                background: "rgba(43,32,23,.55)",
                color: "#fff",
                padding: "4px 8px",
                borderRadius: 6,
                backdropFilter: "blur(2px)",
              }}
            >
              photo · {product.category}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
