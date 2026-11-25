"use client";

import { useState } from "react";
import { QueryClient } from "@tanstack/react-query";

/** 앱 전체에서 공유할 QueryClient를 한 번만 생성해 반환한다. */
export function useAppProviders() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return { queryClient };
}
