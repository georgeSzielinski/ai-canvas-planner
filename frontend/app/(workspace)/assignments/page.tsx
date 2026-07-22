import type { Metadata } from "next";
import { AssignmentsPage } from "@/features/assignments/assignments-page";

export const metadata: Metadata = { title: "Assignments" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ assignment?: string }>;
}) {
  const params = await searchParams;
  return <AssignmentsPage initialAssignmentId={params.assignment} />;
}
