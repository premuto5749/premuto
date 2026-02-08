import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "sonner";
import { Providers } from "@/components/Providers";
import { getSiteSettings } from "@/lib/site-settings";

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();

  return {
    title: settings.siteName,
    description: settings.siteDescription,
    keywords: settings.keywords,
    icons: settings.faviconUrl ? { icon: settings.faviconUrl } : undefined,
    openGraph: {
      title: settings.siteName,
      description: settings.siteDescription,
      images: settings.ogImageUrl ? [settings.ogImageUrl] : undefined,
    },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const settings = await getSiteSettings();

  return {
    themeColor: settings.themeColor,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getSiteSettings();

  return (
    <html lang={settings.language}>
      <body
        className={`${geistMono.variable} antialiased`}
      >
        <Providers>
          {children}
        </Providers>
        <Toaster position="top-center" richColors />
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(function(){})}`,
          }}
        />
      </body>
    </html>
  );
}
