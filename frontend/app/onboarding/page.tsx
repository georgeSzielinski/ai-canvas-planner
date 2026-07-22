import type { Metadata } from "next";
import { Suspense } from "react";
import { OnboardingPage } from "@/features/auth/onboarding-page";

export const metadata: Metadata = { title: "Set up your account" };
export default function Page() {
  return (
    <Suspense fallback={<main className="onboarding-page" />}>
      <OnboardingPage />
    </Suspense>
  );
}
