import Link from "next/link";
import { Broom, ArrowLeft } from "@phosphor-icons/react/dist/ssr";

export default function NotFound() {
  return (
    <main className="not-found">
      <section className="card">
        <span className="feature-icon" style={{ margin: "auto" }}>
          <Broom />
        </span>
        <h1>This plan wandered off.</h1>
        <p>
          The page you requested does not exist. Your demo assignments and settings are still safe.
        </p>
        <Link className="button button-primary" href="/overview">
          <ArrowLeft />
          Back to overview
        </Link>
      </section>
    </main>
  );
}
