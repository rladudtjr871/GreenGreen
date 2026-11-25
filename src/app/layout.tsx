import type { Metadata, Viewport } from "next";

import { AppProviders } from "@/components/AppProviders/AppProviders";
import {
  SITE_DESCRIPTION,
  SITE_SHORT_NAME,
  SITE_THEME_COLOR,
  SITE_TITLE,
} from "@/constants/site";

import "./globals.css";

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
  // iOS는 manifest 대신 이 값으로 홈 화면 아이콘 아래 이름과 단독 실행 여부를 정한다.
  appleWebApp: {
    capable: true,
    title: SITE_SHORT_NAME,
    statusBarStyle: "default",
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: SITE_SHORT_NAME,
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
  themeColor: SITE_THEME_COLOR,
};

/** 공통 Provider로 모든 페이지를 감싸는 루트 레이아웃을 렌더링한다. */
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
