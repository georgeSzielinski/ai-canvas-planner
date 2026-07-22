import type { Metadata } from "next";
import { LegalPage } from "@/features/auth/legal-page";

export const metadata: Metadata = { title: "Terms of Service" };
export default function Page() {
  return <LegalPage kind="terms" />;
}
