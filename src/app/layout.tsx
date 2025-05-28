import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import WaitingRoomFloating from "@/components/layout/WaitingRoomFloating";
import RoomSwitchConfirmModal from "@/components/layout/RoomSwitchConfirmModal";
import QuizRoomRedirectManager from "@/components/layout/QuizRoomRedirectManager";
import ActiveQuizAlertModal from "@/components/layout/ActiveQuizAlertModal";
import RankUpNotification from "@/components/quiz/RankUpNotification";
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
        <meta name="apple-mobile-web-app-icon" content="/favicon512x512.png" />
        <link rel="apple-touch-icon" href="/favicon512x512.png" />
        <link rel="icon" href="/favicon512x512.png" />
        <link rel="shortcut icon" href="/favicon512x512.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/favicon512x512.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/favicon192x192.png" />
        <link rel="icon" type="image/png" sizes="96x96" href="/favicon-192x192.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon192x192.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-192x192.png" />
        <meta name="apple-mobile-web-app-title" content="Zap!" />
        <meta name="application-name" content="Zap!" />
        <meta name="theme-color" content="#ffffff" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="description" content="リアルタイムで友達と対戦できるクイズアプリ！" />
        <meta name="keywords" content="Zap!, クイズ, オンライン, マルチプレイヤー" />
        <meta name="author" content="Zap! Team" />
        <meta name="robots" content="index, follow" />      
        <meta property="og:title" content="Zap! - オンラインマルチクイズアプリケーション" />
        <meta property="og:description" content="リアルタイムで友達と対戦できるクイズアプリ！" />
        <meta property="og:image" content="/path/to/your/image.jpg" />
        <meta property="og:url" content="https://zap-quiz.onrender.com" />
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
            <RoomSwitchConfirmModal />
            <QuizRoomRedirectManager />
            <ActiveQuizAlertModal />
            <RankUpNotification />
          </QuizProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
