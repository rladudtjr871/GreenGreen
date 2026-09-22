import type { Metadata, Viewport } from "next";

import { AppProviders } from "@/components/AppProviders/AppProviders";

import "./globals.css";

export const metadata: Metadata = {
  title: "GreenGreen | 서울 보행자 신호 지도",
  description: "내 주변의 보행자 신호를 지도에서 확인하세요.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#03c75a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
