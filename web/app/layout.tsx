import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Limit Order Book Simulator",
  description: "A price-time priority matching engine running client-side via WebAssembly.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
