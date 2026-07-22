import type { Metadata } from "next";
import { InsightsPage } from "@/features/insights/insights-page";

export const metadata: Metadata = { title: "Insights" };
export default function Page() {
  return <InsightsPage />;
}
