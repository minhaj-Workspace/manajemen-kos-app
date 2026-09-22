import type { Metadata, Viewport } from "next";
import "./globals.css";
import GlobalCommandMenu from "@/components/GlobalCommandMenu";

export const metadata: Metadata = {
  title: "Kos-App Management System",
  description: "Sistem pengelolaan kamar dan operasional kos harian.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kos-App",
  },
};

// Memisahkan themeColor ke generateViewport sesuai standar Next.js terbaru
export const viewport: Viewport = {
  themeColor: "#1a202c",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Kos-App" />
      </head>
      <body style={{ backgroundColor: '#0f172a', color: '#fff', margin: 0, padding: 0, minHeight: '100vh' }}>
        {children}
        
        {/* Global Command Menu (Ctrl + K) aktif secara otomatis di seluruh aplikasi */}
        <GlobalCommandMenu />
      </body>
    </html>
  );
}