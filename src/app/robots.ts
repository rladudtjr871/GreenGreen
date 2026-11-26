import type { MetadataRoute } from "next";

/** 검색 엔진 크롤러가 서비스 페이지는 수집하고 내부 API는 수집하지 않도록 robots.txt를 생성한다. */
export default function robots(): MetadataRoute.Robots {
  // API 응답은 토큰이 없으면 오류만 반환하고 검색 결과로 쓸 내용도 없으므로 크롤링에서 제외한다.
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/api/",
    },
  };
}
