// app/promociones/layout.tsx
export default function PromocionesLayout({
    children,
  }: {
    children: React.ReactNode;
  }) {
    return (
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "24px 24px 40px",
        }}
      >
        {children}
      </div>
    );
  }
  