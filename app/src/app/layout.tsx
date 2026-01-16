import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import { ShareProvider } from "@/contexts/ShareContext";
import ShareBasket from "@/components/ShareBasket";
import WebVitals from "@/components/WebVitals";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Quilting Patterns",
  description: "Browse and download quilting patterns",
};

// Extract origin from Supabase URL for preconnect hints
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : null;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Preconnect to external domains for faster resource loading */}
        {supabaseOrigin && (
          <>
            <link rel="preconnect" href={supabaseOrigin} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={supabaseOrigin} />
          </>
        )}
        <link rel="preconnect" href="https://matomo.tachyonfuture.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://matomo.tachyonfuture.com" />
        <Script id="matomo-analytics" strategy="afterInteractive">
          {`
            var _paq = window._paq = window._paq || [];
            _paq.push(['trackPageView']);
            _paq.push(['enableLinkTracking']);
            (function() {
              var u="https://matomo.tachyonfuture.com/";
              _paq.push(['setTrackerUrl', u+'matomo.php']);
              _paq.push(['setSiteId', '15']);
              var d=document, g=d.createElement('script'), s=d.getElementsByTagName('script')[0];
              g.async=true; g.src=u+'matomo.js'; s.parentNode.insertBefore(g,s);
            })();
          `}
        </Script>
      </head>
      <body className={`${inter.className} antialiased bg-gradient-to-br from-purple-300 via-blue-300 to-indigo-400 min-h-screen`}>
        <WebVitals />
        <ToastProvider>
          <ShareProvider>
            {children}
            <ShareBasket />
          </ShareProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
