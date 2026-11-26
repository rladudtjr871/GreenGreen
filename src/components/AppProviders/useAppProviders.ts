"use client";

import { useState } from "react";
import { QueryClient } from "@tanstack/react-query";

import { ApiResponseError } from "@/services/greenGreenApi";

/** 일시적인 오류만 한 번 재시도하고 요청 자체가 거절된 4xx 오류는 재시도하지 않는다. */
function shouldRetryQuery(failureCount: number, error: Error): boolean {
  // 호출 횟수 초과(429)나 토큰 만료(401)는 다시 보내도 같은 결과이고 제한 횟수만 더 소모한다.
  if (error instanceof ApiResponseError && error.status < 500) {
    return false;
  }

  return failureCount < 1;
}

/** 앱 전체에서 공유할 QueryClient를 한 번만 생성해 반환한다. */
export function useAppProviders() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: shouldRetryQuery,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return { queryClient };
}
