import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

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
      <body className={`${inter.className} antialiased bg-gradient-to-br from-purple-200 via-blue-200 to-indigo-300 min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
