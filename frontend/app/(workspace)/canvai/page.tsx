import type { Metadata } from "next";
import { CanvaiPage } from "@/features/canvai/canvai-page";

export const metadata: Metadata = { title: "Canvai" };
export default function Page() {
  return <CanvaiPage />;
}
