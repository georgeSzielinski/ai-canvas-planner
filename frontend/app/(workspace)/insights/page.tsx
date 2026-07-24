import type { Metadata } from "next";
import { EmptyState } from "@/components/common/ui";

export const metadata: Metadata = { title: "Insights" };
export default function Page() {
  return (
    <EmptyState
      title="No planning insights yet"
      body="Insights will appear after real study sessions have been planned and their progress has been recorded."
    />
  );
}
