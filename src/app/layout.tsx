import type { Metadata, Viewport } from "next";
import Script from "next/script";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "CreatorConnect",
    template: "%s | CreatorConnect",
  },
  description: "Creator & brand sponsorship collaboration platform",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#5b4bdb",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {children}
        <Script
          src="/theme-init.js"
          strategy="beforeInteractive"
        />
      </body>
    </html>
  );
}
