"use client";

import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";

import styles from "./AppProviders.module.css";
import { useAppProviders } from "./useAppProviders";

type AppProvidersProps = {
  /** React Query 컨텍스트를 제공받을 애플리케이션 하위 UI다. */
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  const { queryClient } = useAppProviders();

  return (
    <QueryClientProvider client={queryClient}>
      <div className={styles.provider}>{children}</div>
    </QueryClientProvider>
  );
}
