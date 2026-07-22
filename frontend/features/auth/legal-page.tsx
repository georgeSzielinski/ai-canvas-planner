import Link from "next/link";
import { Logo } from "@/components/common/logo";

const privacySections = [
  [
    "Information we collect",
    "When you sign in, we receive your Google account name, email address, profile photo, and stable account identifier. We also store the study preferences you choose.",
  ],
  [
    "How we use information",
    "We use account and schedule information only to provide, secure, and improve Canvas Sweeper and Canvai planning features.",
  ],
  [
    "Calendar access",
    "Google Calendar access is optional and requires separate consent. You choose which calendars Canvai may use, and you can disconnect access.",
  ],
  [
    "Your choices",
    "You can update your profile and preferences at any time. Contact the service operator to request access, correction, export, or deletion.",
  ],
];
const termsSections = [
  [
    "Using the service",
    "You must use Canvas Sweeper lawfully and keep your Google account secure. You are responsible for reviewing study plans before relying on them.",
  ],
  [
    "Third-party services",
    "Google and Canvas are independent services with their own terms. Canvas Sweeper is not affiliated with Instructure or Google.",
  ],
  [
    "Availability",
    "The service may change or be interrupted. Study suggestions are planning assistance, not a guarantee of academic outcomes.",
  ],
  [
    "Acceptable use",
    "Do not misuse the service, attempt unauthorized access, disrupt other users, or upload content you do not have permission to use.",
  ],
];

export function LegalPage({ kind }: { kind: "privacy" | "terms" }) {
  const privacy = kind === "privacy";
  const title = privacy ? "Privacy Policy" : "Terms of Service";
  const sections = privacy ? privacySections : termsSections;
  return (
    <main className="legal-page">
      <header className="legal-header">
        <Logo />
        <Link href="/login">Sign in</Link>
      </header>
      <article className="legal-document card">
        <span className="eyebrow">Canvas Sweeper</span>
        <h1>{title}</h1>
        <p className="legal-updated">Effective July 21, 2026</p>
        <p>
          {privacy
            ? "This policy explains what account information Canvas Sweeper handles and the controls available to you."
            : "These terms govern your use of Canvas Sweeper and Canvai."}
        </p>
        {sections.map(([heading, body]) => (
          <section key={heading}>
            <h2>{heading}</h2>
            <p>{body}</p>
          </section>
        ))}
        <p className="legal-contact">
          Questions? Contact the service operator listed in your deployment.
        </p>
      </article>
    </main>
  );
}
