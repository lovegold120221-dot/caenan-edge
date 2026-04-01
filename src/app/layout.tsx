import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { PLATFORM_DESCRIPTION, PLATFORM_NAME } from "@/lib/brand";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: PLATFORM_NAME,
  description: PLATFORM_DESCRIPTION,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: PLATFORM_NAME,
  },
  icons: {
    apple: "/apple-touch-icon.png",
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* Animated Background Wave */}
        <div className="wave-container">
          <div className="wave"></div>
          <div className="wave2"></div>
        </div>
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}
