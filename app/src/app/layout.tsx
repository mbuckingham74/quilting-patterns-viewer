import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import { ShareProvider } from "@/contexts/ShareContext";
import ShareBasket from "@/components/ShareBasket";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Quilting Patterns",
  description: "Browse and download quilting patterns",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased bg-gradient-to-br from-purple-300 via-blue-300 to-indigo-400 min-h-screen`}>
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
