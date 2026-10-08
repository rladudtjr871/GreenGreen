import type { Metadata } from "next";

import { GuideContent } from "@/components/GuideContent/GuideContent";

export const metadata: Metadata = {
  title: "사용 가이드 | GreenGreen",
  description: "GreenGreen의 신호등, 쓰레기통, 화장실 기능 사용법을 확인하세요.",
};

export default function GuidePage() {
  return <GuideContent />;
}
