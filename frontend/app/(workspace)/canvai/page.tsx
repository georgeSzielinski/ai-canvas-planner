import type { Metadata } from "next";
import { EmptyState } from "@/components/common/ui";

export const metadata: Metadata = { title: "Planning" };
export default function Page() {
  return (
    <EmptyState
      title="No schedule draft yet"
      body="Connect Canvas and Google Calendar, then configure your routines and study preferences before generating a schedule draft."
    />
  );
}
