import { Suspense } from "react";
import { ProtectedWorkspace } from "@/components/auth/protected-workspace";
import { AppShell } from "@/components/app-shell/app-shell";
import { LoadingState } from "@/components/common/ui";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="auth-loading">
          <LoadingState label="Checking your session" />
        </div>
      }
    >
      <ProtectedWorkspace>
        <AppShell>{children}</AppShell>
      </ProtectedWorkspace>
    </Suspense>
  );
}
