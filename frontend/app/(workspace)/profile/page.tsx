import type { Metadata } from "next";
import { ProfilePage } from "@/features/auth/profile-page";

export const metadata: Metadata = { title: "Profile" };
export default function Page() {
  return <ProfilePage />;
}
