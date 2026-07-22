"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { GoogleLogo, ShieldCheck } from "@phosphor-icons/react";
import { useAuth } from "@/components/auth/auth-provider";
import { Logo } from "@/components/common/logo";
import { authService } from "@/lib/auth-service";

export function LoginPage() {
  const params = useSearchParams();
  const { sessionMessage } = useAuth();
  const oauthError = params.get("error");
  const destination = params.get("next");

  return (
    <main className="auth-page">
      <section className="auth-card card" aria-labelledby="login-title">
        <Logo />
        <div className="auth-heading">
          <span className="feature-icon">
            <ShieldCheck />
          </span>
          <h1 id="login-title">Sign in to Canvas Sweeper</h1>
          <p>Use your Google account to continue to your private study workspace.</p>
        </div>
        {(oauthError || sessionMessage) && (
          <div className="auth-alert" role="alert">
            {sessionMessage ?? "We could not complete Google Sign-In. Please try again."}
          </div>
        )}
        <a
          className="button button-primary google-button"
          href={authService.googleSignInUrl(true, destination)}
        >
          <GoogleLogo weight="bold" /> Continue with Google
        </a>
        <p className="auth-fineprint">
          By continuing, you agree to our <Link href="/terms">Terms of Service</Link> and
          acknowledge our <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </section>
    </main>
  );
}
