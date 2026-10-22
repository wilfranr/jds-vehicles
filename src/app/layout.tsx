import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JDS Vehículos",
  description: "Concesionario digital de vehículos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased min-h-screen bg-neutral-950 text-neutral-100">
        {children}
      </body>
    </html>
  );
}
