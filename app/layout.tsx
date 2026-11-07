import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "OpenBench AI",
  description: "Production-grade AI infrastructure benchmarking platform."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
