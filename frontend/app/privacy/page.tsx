import type { Metadata } from "next";
import { LegalPage } from "@/features/auth/legal-page";

export const metadata: Metadata = { title: "Privacy Policy" };
export default function Page() {
  return <LegalPage kind="privacy" />;
}
