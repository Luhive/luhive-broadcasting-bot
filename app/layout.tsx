import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Luhive",
  description: "Luhive Community Engine",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="az">
      <body>{children}</body>
    </html>
  );
}
