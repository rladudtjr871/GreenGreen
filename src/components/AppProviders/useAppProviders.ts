"use client";

import { useState } from "react";
import { QueryClient } from "@tanstack/react-query";

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
