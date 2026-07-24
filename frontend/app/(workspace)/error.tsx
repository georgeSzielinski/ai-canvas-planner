"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/common/ui";

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset(): void;
}) {
  useEffect(() => {
    console.error("Canvas Sweeper workspace render failed", error);
  }, [error]);

  return <ErrorState retry={reset} />;
}
