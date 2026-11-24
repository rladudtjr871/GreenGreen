import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  // 홈 화면에 추가했을 때 브라우저 주소창 없이 앱처럼 열리도록 standalone으로 설정한다.
  // 아이콘은 Android가 사용하는 일반(any) 아이콘과, 기기별 모양으로 잘려도 신호등이 보이도록
  // 여백을 둔 maskable 아이콘을 분리해 제공한다.
  return {
    name: "GreenGreen | 서울 보행자 신호 지도",
    short_name: "GreenGreen",
    description: "내 주변의 보행자 신호를 지도에서 확인하세요.",
    start_url: "/",
    display: "standalone",
    background_color: "#173b2a",
    theme_color: "#03c75a",
    lang: "ko",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
