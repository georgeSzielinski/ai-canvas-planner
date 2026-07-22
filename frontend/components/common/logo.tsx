import { Broom } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

export function Logo({
  compact = false,
  subtitle = "Demo workspace",
}: {
  compact?: boolean;
  subtitle?: string;
}) {
  return (
    <Link className="logo" href="/" aria-label="Canvas Sweeper home">
      <span className="logo-mark">
        <Broom weight="fill" aria-hidden="true" />
      </span>
      {!compact && (
        <span>
          <strong>Canvas Sweeper</strong>
          <small>{subtitle}</small>
        </span>
      )}
    </Link>
  );
}
