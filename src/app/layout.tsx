import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import WaitingRoomFloating from "@/components/layout/WaitingRoomFloating";
import { AuthProvider } from "@/context/AuthContext";
import { QuizProvider } from "@/context/QuizContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Zap! - オンラインマルチクイズアプリケーション",
  description: "リアルタイムで友達と対戦できるクイズアプリ！",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <Script src="//cdn.jsdelivr.net/npm/eruda" strategy="beforeInteractive" />
        <Script id="eruda-init" strategy="afterInteractive">
          {`eruda.init();`}
        </Script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen`}
      >
        <AuthProvider>
          <QuizProvider>
            <Header />
            <main className="flex-grow">{children}</main>
            <Footer />
            <WaitingRoomFloating />
          </QuizProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
