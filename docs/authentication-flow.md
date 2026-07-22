# Authentication flow

## Overview

Canvas Sweeper uses Google OpenID Connect for identity and a separate Google OAuth grant for Calendar. Provider access tokens are never returned to browser JavaScript. The backend exchanges authorization codes and creates an opaque, revocable, server-side session.

## Sign-in

1. The login page sends the browser to `GET /api/v1/auth/google/start?remember=true`.
2. The backend creates a short-lived, HMAC-signed state value and redirects to Google with `openid email profile` scopes.
3. Google returns to `/api/v1/auth/google/callback`.
4. The backend validates state, exchanges the one-time code, retrieves the verified Google identity, and creates or updates `user_profiles`.
5. An opaque random token is stored only as a SHA-256 hash in `auth_sessions`. The raw token is sent in an HttpOnly, `SameSite=Lax` cookie. Production/staging cookies are `Secure`.
6. New users are redirected to onboarding; returning users go to Overview.

The normal session lifetime is 12 hours. “Remember me” sessions last 30 days by default. Both are configurable. Every request checks server-side expiry and revocation. Logout revokes the database row and removes both cookies.

## CSRF

Mutating authenticated endpoints require `X-CSRF-Token`. The independent random CSRF value is available to the frontend through the session response/cookie, while only its SHA-256 hash is stored server-side. The API client sends cookies with `credentials: include` and adds this header. OAuth callbacks use signed, action-bound, ten-minute state values.

## Route policy

Public frontend routes are `/`, `/login`, `/privacy`, and `/terms`. Workspace, onboarding, and profile routes validate `/api/v1/auth/session` before rendering. Backend health/readiness and OAuth callbacks are public; user data and mutations require a valid session, with CSRF on mutations.

## Session expiration

A missing, revoked, or expired session returns HTTP 401 with an actionable sign-in message. The frontend clears its authenticated state and routes to Login. Calendar credentials expiring is distinct: the backend attempts refresh first, then marks the calendar connection `reauthentication_required` if refresh is unavailable or rejected.
