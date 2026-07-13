export function KenteRule({ style }: { style?: React.CSSProperties }) {
  return (
    <div
      style={{
        height: 6,
        borderRadius: 3,
        ...style,
        backgroundImage:
          "repeating-linear-gradient(90deg, var(--terracotta) 0 14px, var(--gold) 14px 24px, var(--green) 24px 38px, var(--ink) 38px 44px)",
      }}
    />
  );
}
