"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { authService, userService } from "@/lib/auth-service";
import { setApiCsrfToken } from "@/services/api-client";
import type { AuthUser, OnboardingUpdate, SessionStatus, UserUpdate } from "@/types/auth";

type AuthStatus = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  session: SessionStatus | null;
  sessionMessage: string | null;
  refresh(): Promise<void>;
  logout(): Promise<void>;
  updateProfile(update: UserUpdate): Promise<AuthUser>;
  completeOnboarding(update: OnboardingUpdate): Promise<AuthUser>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<SessionStatus | null>(null);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const nextSession = await authService.getSession();
      setSession(nextSession);
      setApiCsrfToken(nextSession.csrf_token);
      if (!nextSession.authenticated) {
        setUser(null);
        setStatus("anonymous");
        return;
      }
      const nextUser = await authService.getCurrentUser();
      setUser(nextUser);
      setStatus("authenticated");
    } catch {
      setApiCsrfToken(null);
      setSession(null);
      setUser(null);
      setStatus("anonymous");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    const onExpired = () => {
      setApiCsrfToken(null);
      setSession(null);
      setUser(null);
      setStatus("anonymous");
      setSessionMessage("Your session expired. Please sign in again.");
    };
    window.addEventListener("auth:session-expired", onExpired);
    return () => window.removeEventListener("auth:session-expired", onExpired);
  }, []);

  const requireCsrf = () => {
    if (!session?.csrf_token)
      throw new Error("Your session cannot be verified. Please sign in again.");
    return session.csrf_token;
  };

  const logout = async () => {
    try {
      await authService.logout(requireCsrf());
    } finally {
      setApiCsrfToken(null);
      setSession(null);
      setUser(null);
      setStatus("anonymous");
      router.replace("/login");
    }
  };

  const updateProfile = async (update: UserUpdate) => {
    const nextUser = await userService.updateProfile(update, requireCsrf());
    setUser(nextUser);
    return nextUser;
  };

  const completeOnboarding = async (update: OnboardingUpdate) => {
    const nextUser = await userService.completeOnboarding(update, requireCsrf());
    setUser(nextUser);
    return nextUser;
  };

  const value: AuthContextValue = {
    status,
    user,
    session,
    sessionMessage,
    refresh,
    logout,
    updateProfile,
    completeOnboarding,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useOptionalAuth() {
  return useContext(AuthContext);
}

export function useAuth() {
  const value = useOptionalAuth();
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
