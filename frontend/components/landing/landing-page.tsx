"use client";

import Link from "next/link";
import {
  ArrowCounterClockwise,
  ArrowRight,
  Brain,
  Broom,
  CalendarCheck,
  CalendarDots,
  CalendarPlus,
  Eye,
  GraduationCap,
  HandPointing,
  LockSimple,
  Moon,
  PlugsConnected,
  ShieldCheck,
  Sparkle,
  SquaresFour,
  Sun,
} from "@phosphor-icons/react";
import { Logo } from "@/components/common/logo";
import { Badge, Card, ToastRegion } from "@/components/common/ui";
import { useApp } from "@/components/common/app-provider";
import { useOptionalAuth } from "@/components/auth/auth-provider";

const benefits = [
  {
    icon: Brain,
    title: "Uses real assignment data",
    body: "Deterministic rules use assignment type, points, and due dates to explain estimates and priority.",
  },
  {
    icon: CalendarCheck,
    title: "Plans around real life",
    body: "Study blocks slot between school, commuting, rowing, and dinner — not on top of them.",
  },
  {
    icon: ArrowCounterClockwise,
    title: "Adapts when plans change",
    body: "Changes produce a reviewable proposal; published calendar events are never rewritten without approval.",
  },
  {
    icon: Moon,
    title: "Protects sleep & training",
    body: "Guardrails keep late nights, Sunday overload, and race weeks in check.",
  },
];

const steps = [
  {
    icon: PlugsConnected,
    title: "Connect Canvas",
    body: "Import assignments, tests, and due dates in one step.",
  },
  {
    icon: CalendarPlus,
    title: "Add your week",
    body: "Block out school, sports, sleep, and commitments once.",
  },
  {
    icon: Sparkle,
    title: "Build a draft plan",
    body: "Study sessions land in the free time you actually have.",
  },
  {
    icon: HandPointing,
    title: "Adjust anytime",
    body: "Preview, lock, or reschedule — the week stays balanced.",
  },
];

export function LandingPage() {
  const auth = useOptionalAuth();
  const { calendarConnection, canvasConnection, theme, setTheme } = useApp();
  const isDark = theme === "dark";
  const authenticated = auth?.status === "authenticated";
  const workspaceLabel = authenticated ? "Open workspace" : "Sign in";
  const workspaceHref = authenticated ? "/overview" : "/login";
  const canvasStatus = canvasConnection?.connected
    ? "● Connected"
    : canvasConnection?.configured
      ? "● Needs attention"
      : authenticated
        ? "● Checking"
        : "● Sign in required";
  const calendarStatus = calendarConnection?.connected
    ? "● Connected"
    : authenticated
      ? "● Checking"
      : "● Not connected";
  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <Logo />
          <nav className="landing-links" aria-label="Landing navigation">
            <a href="#product">Product</a>
            <a href="#how">How it works</a>
            <a href="#connect">Connections</a>
            <a href="#privacy">Privacy</a>
          </nav>
          <button
            className="icon-button"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
          >
            {isDark ? <Sun /> : <Moon />}
          </button>
          <Link href={workspaceHref} className="button button-primary">
            {workspaceLabel} <ArrowRight />
          </Link>
        </div>
      </header>
      <main>
        <section className="landing-section hero">
          <div className="hero-copy">
            <span className="hero-kicker">
              <Sparkle weight="fill" />
              Deterministic, explainable study planning
            </span>
            <h1>Turn Canvas deadlines into a realistic study plan.</h1>
            <p>
              Canvas Sweeper combines assignments, routines, preferences, and calendar availability
              to create a draft you can review before anything is published.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" href={workspaceHref}>
                <SquaresFour weight="fill" />
                {authenticated ? "Open your workspace" : "Sign in with Google"}
              </Link>
              <a className="button" href="#how">
                See how it works
              </a>
            </div>
            <div className="demo-note">
              <LockSimple />
              {authenticated
                ? "Private workspace · connection data stays in your account."
                : "Sign in to create a private workspace and connect your providers."}
            </div>
          </div>
        </section>
        <section className="landing-section" id="product">
          <div className="landing-heading">
            <div className="eyebrow">Why Canvas Sweeper</div>
            <h2>Planning that respects your whole week.</h2>
          </div>
          <div className="landing-grid">
            {benefits.map(({ icon: Icon, title, body }) => (
              <Card className="benefit-card" key={title}>
                <span className="feature-icon">
                  <Icon />
                </span>
                <h3>{title}</h3>
                <p>{body}</p>
              </Card>
            ))}
          </div>
        </section>
        <section className="landing-section" id="how">
          <div className="landing-heading">
            <div className="eyebrow">How it works</div>
            <h2>From Canvas import to a plan you can follow.</h2>
          </div>
          <div className="landing-grid">
            {steps.map(({ icon: Icon, title, body }, index) => (
              <Card className="step-card" key={title}>
                <div className="step-top">
                  <span>0{index + 1}</span>
                  <Icon />
                </div>
                <h3>{title}</h3>
                <p>{body}</p>
              </Card>
            ))}
          </div>
        </section>
        <section className="landing-section" id="connect">
          <Card className="connections-band">
            <div>
              <div className="eyebrow">Connections</div>
              <h2>Bring your assignments and calendar together.</h2>
              <p>
                {authenticated
                  ? "Your account connections and imported work are available in your private workspace."
                  : "Sign in to create an empty private workspace, then connect only the providers you choose."}
              </p>
              <div className="demo-note">
                <LockSimple />
                Independent product — not affiliated with Instructure or Google.
              </div>
            </div>
            <div className="connection-cards">
              <div className="connection-card">
                <span className="feature-icon">
                  <GraduationCap />
                </span>
                <div>
                  <strong>Canvas</strong>
                  <small>Assignments, tests, due dates & points</small>
                </div>
                <Badge tone={canvasConnection?.connected ? "success" : "warning"}>
                  {canvasStatus}
                </Badge>
              </div>
              <div className="connection-card">
                <span className="feature-icon">
                  <CalendarDots />
                </span>
                <div>
                  <strong>Google Calendar</strong>
                  <small>Existing events & where study lands</small>
                </div>
                <Badge tone={calendarConnection?.connected ? "success" : "neutral"}>
                  {calendarStatus}
                </Badge>
              </div>
            </div>
          </Card>
        </section>
        <section className="landing-section" id="privacy">
          <div className="landing-heading">
            <div className="eyebrow">Privacy & control</div>
            <h2>Canvai proposes. You always decide.</h2>
          </div>
          <div className="landing-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            {[
              {
                icon: Eye,
                title: "Preview before publishing",
                body: "Review every change before it ever touches your calendar.",
              },
              {
                icon: ArrowCounterClockwise,
                title: "Reversible by design",
                body: "Undo, lock sessions, or restore a previous schedule anytime.",
              },
              {
                icon: ShieldCheck,
                title: "Your data stays yours",
                body: "Assignments and schedules are used only to plan your week.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <Card className="benefit-card" key={title}>
                <Icon className="feature-icon" />
                <h3>{title}</h3>
                <p>{body}</p>
              </Card>
            ))}
          </div>
        </section>
        <section className="landing-section">
          <Card className="cta-card">
            <Broom className="feature-icon" />
            <h2>{authenticated ? "Your workspace is ready." : "Ready to sweep your Canvas?"}</h2>
            <p>
              {authenticated
                ? "Open your private workspace to review imported assignments and connection status."
                : "Sign in to start with an empty private workspace. No sample assignments are inserted."}
            </p>
            <Link className="button button-primary" href={workspaceHref}>
              {authenticated ? "Open your workspace" : "Sign in"} <ArrowRight />
            </Link>
          </Card>
        </section>
      </main>
      <footer className="landing-footer">
        <div className="footer-grid">
          <div>
            <Logo />
            <p>The AI study planner that turns deadlines into a schedule you can actually keep.</p>
          </div>
          <div className="footer-links">
            <strong>Product</strong>
            <a href="#product">Overview</a>
            <a href="#how">How it works</a>
            <a href="#connect">Connections</a>
          </div>
          <div className="footer-links">
            <strong>Explore</strong>
            <Link href={workspaceHref}>{authenticated ? "Workspace" : "Sign in"}</Link>
            <Link href="/assignments">Assignments</Link>
            <Link href="/canvai">Canvai</Link>
          </div>
          <div className="footer-links">
            <strong>Trust</strong>
            <a href="#privacy">Privacy & control</a>
            <a href="#connect">Connection status</a>
            <Link href="/settings">Settings</Link>
          </div>
        </div>
        <div className="footer-bottom">
          <div>
            © 2026 Canvas Sweeper. Not affiliated with Instructure Canvas or Google.
            {authenticated
              ? " Connection status is shown from your private workspace."
              : " Provider connections are not active until you sign in."}
          </div>
        </div>
      </footer>
      <ToastRegion />
    </div>
  );
}
