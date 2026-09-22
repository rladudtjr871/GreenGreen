import type { Metadata, Viewport } from "next";

import { AppProviders } from "@/components/AppProviders/AppProviders";

import "./globals.css";

const SITE_TITLE = "GreenGreen | 서울 보행자 신호 지도";
const SITE_DESCRIPTION = "내 주변의 보행자 신호를 지도에서 확인하세요.";
const SHARE_IMAGE_PATH = "/images/greengreen-share.png";

// 1. 명시한 서비스 주소를 우선하고, 배포 환경에서는 Vercel이 제공하는 주소를 사용한다.
// 절대 URL이 필요한 공유 이미지가 로컬과 배포 환경 모두에서 올바르게 생성되도록 한다.
const configuredSiteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.VERCEL_PROJECT_PRODUCTION_URL ??
  process.env.VERCEL_URL ??
  "http://localhost:3000";

// 2. Vercel 시스템 환경변수에는 프로토콜이 없으므로 URL 객체 생성 전에 보완한다.
// 이미 프로토콜이 포함된 사용자 설정값은 그대로 유지한다.
const metadataBaseUrl = configuredSiteUrl.startsWith("http")
  ? configuredSiteUrl
  : `https://${configuredSiteUrl}`;

export const metadata: Metadata = {
  metadataBase: new URL(metadataBaseUrl),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "GreenGreen",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: SHARE_IMAGE_PATH,
        width: 1200,
        height: 630,
        alt: "GreenGreen 서울 보행자 신호 지도",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [SHARE_IMAGE_PATH],
  },
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
