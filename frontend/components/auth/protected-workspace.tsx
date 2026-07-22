"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { LoadingState } from "@/components/common/ui";

export function ProtectedWorkspace({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.toString();
  const destination = query ? `${pathname}?${query}` : pathname;

  useEffect(() => {
    if (status === "anonymous") {
      router.replace(`/login?next=${encodeURIComponent(destination)}`);
    } else if (status === "authenticated" && user && !user.onboarding_complete) {
      router.replace(`/onboarding?next=${encodeURIComponent(destination)}`);
    }
  }, [destination, router, status, user]);

  if (status === "loading") {
    return (
      <div className="auth-loading">
        <LoadingState label="Checking your session" />
      </div>
    );
  }
  if (status !== "authenticated" || !user?.onboarding_complete) return null;
  return children;
}
