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

const benefits = [
  {
    icon: Brain,
    title: "Reads every assignment",
    body: "Canvai weighs type, points, and due date to estimate time, difficulty, and urgency.",
  },
  {
    icon: CalendarCheck,
    title: "Plans around real life",
    body: "Study blocks slot between school, commuting, rowing, and dinner — not on top of them.",
  },
  {
    icon: ArrowCounterClockwise,
    title: "Adapts when plans change",
    body: "Miss a session or add an event and the week quietly rebuilds itself.",
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
    title: "Canvai builds a plan",
    body: "Study sessions land in the free time you actually have.",
  },
  {
    icon: HandPointing,
    title: "Adjust anytime",
    body: "Preview, lock, or reschedule — the week stays balanced.",
  },
];

export function LandingPage() {
  const { theme, setTheme } = useApp();
  const isDark = theme === "dark";
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
          <Link href="/overview" className="button button-primary">
            Open demo <ArrowRight />
          </Link>
        </div>
      </header>
      <main>
        <section className="landing-section hero">
          <div className="hero-copy">
            <span className="hero-kicker">
              <Sparkle weight="fill" />
              Meet Canvai — your AI study planner
            </span>
            <h1>Turn Canvas deadlines into a realistic study plan.</h1>
            <p>
              Canvai analyzes your assignments, checks your schedule, and plans when you should
              actually do the work — around school, rowing, and sleep.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/overview">
                <SquaresFour weight="fill" />
                Open the demo dashboard
              </Link>
              <a className="button" href="#how">
                See how it works
              </a>
            </div>
            <div className="demo-note">
              <LockSimple />
              Demo mode · not connected to live Canvas or Google Calendar yet.
            </div>
          </div>
          <div className="product-preview" aria-label="Canvas Sweeper dashboard preview">
            <div className="preview-chrome">
              <i />
              <i />
              <i />
              <span>Canvas Sweeper — Overview</span>
              <Badge tone="warning">DEMO</Badge>
            </div>
            <div className="preview-body">
              <div className="preview-greeting">
                <div>
                  <strong>Good evening, Maya</strong>
                  <small>Wednesday · 2 sessions planned tonight</small>
                </div>
                <Badge tone="success">● Plan ready</Badge>
              </div>
              <div className="preview-metrics">
                <div>
                  <small>Due within 48h</small>
                  <strong>5</strong>
                </div>
                <div>
                  <small>Study today</small>
                  <strong>1h 30m</strong>
                </div>
              </div>
              <div className="preview-agenda">
                <div>
                  <i />
                  <span>Rowing practice</span>
                  <time>4:30</time>
                </div>
                <div>
                  <i />
                  <span>AP Seminar — draft</span>
                  <time>8:30</time>
                </div>
                <div>
                  <i />
                  <span>Physics — test prep</span>
                  <time>9:25</time>
                </div>
              </div>
              <div className="preview-insight">
                <Sparkle weight="fill" />
                Two writing-heavy assignments this week — starting the essay tonight keeps Sunday
                light.
              </div>
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
                You connect accounts during onboarding. Until then, Canvas Sweeper runs on realistic
                sample data so you can explore the full experience.
              </p>
              <div className="demo-note">
                <LockSimple />
                Independent concept demo — not affiliated with Instructure or Google.
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
                <Badge tone="warning">● Demo mode</Badge>
              </div>
              <div className="connection-card">
                <span className="feature-icon">
                  <CalendarDots />
                </span>
                <div>
                  <strong>Google Calendar</strong>
                  <small>Existing events & where study lands</small>
                </div>
                <Badge>● Not connected</Badge>
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
            <h2>Ready to sweep your Canvas?</h2>
            <p>Explore the full planning experience with demo data — no account required.</p>
            <Link className="button button-primary" href="/overview">
              Open the demo dashboard <ArrowRight />
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
            <Link href="/overview">Demo dashboard</Link>
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
            © 2026 Canvas Sweeper — concept demo. Not affiliated with Instructure Canvas or Google.
            No integrations are currently active.
          </div>
        </div>
      </footer>
      <ToastRegion />
    </div>
  );
}
