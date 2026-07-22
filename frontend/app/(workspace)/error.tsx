"use client";

import { ErrorState } from "@/components/common/ui";

export default function WorkspaceError({
  reset,
}: {
  error: Error & { digest?: string };
  reset(): void;
}) {
  return <ErrorState retry={reset} />;
}
