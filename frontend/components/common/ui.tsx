"use client";

import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type ElementType,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { ArrowClockwise, CheckCircle, Info, X } from "@phosphor-icons/react";
import { useApp } from "./app-provider";

export function Button({
  variant = "secondary",
  icon,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "quiet" | "danger";
  icon?: ReactNode;
}) {
  return (
    <button className={`button button-${variant} ${className}`} {...props}>
      {icon}
      {children}
    </button>
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "accent" | "warning" | "danger" | "success";
  children: ReactNode;
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Card({
  children,
  className = "",
  as: Tag = "section",
  ...props
}: { children: ReactNode; className?: string; as?: ElementType } & HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={`card ${className}`} {...props}>
      {children}
    </Tag>
  );
}

export function SectionHeader({
  title,
  eyebrow,
  aside,
}: {
  title: string;
  eyebrow?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="section-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2>{title}</h2>
      </div>
      {aside}
    </div>
  );
}

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  width = "560px",
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose(): void;
  children: ReactNode;
  width?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>("button, input, select, textarea")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab" && panel) {
        const focusable = [
          ...panel.querySelectorAll<HTMLElement>(
            "button:not([disabled]), input, select, textarea, a[href]",
          ),
        ];
        if (!focusable.length) return;
        const first = focusable[0],
          last = focusable.at(-1)!;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("modal-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("modal-open");
      previous?.focus();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-root">
      <button className="modal-backdrop" aria-label="Close dialog" onClick={onClose} />
      <div
        ref={panelRef}
        className="modal-panel"
        style={{ maxWidth: width }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-header">
          <div>
            <h2 id="modal-title">{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="state-panel">
      <span className="state-icon">
        <Info />
      </span>
      <h2>{title}</h2>
      <p>{body}</p>
      {action}
    </div>
  );
}

export function LoadingState({ label = "Loading workspace" }: { label?: string }) {
  return (
    <div className="skeleton-stack" role="status" aria-label={label}>
      <span className="skeleton skeleton-title" />
      <span className="skeleton" />
      <span className="skeleton" />
    </div>
  );
}

export function ErrorState({ retry }: { retry?(): void }) {
  return (
    <div className="state-panel state-error">
      <span className="state-icon">
        <Info />
      </span>
      <h2>We couldn’t load this view</h2>
      <p>Your data has not been changed. Check your connection, then try again.</p>
      {retry && (
        <Button onClick={retry} icon={<ArrowClockwise />}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function ToastRegion() {
  const { toast } = useApp();
  if (!toast) return <div className="sr-only" aria-live="polite" />;
  return (
    <div className="toast" role="status">
      <CheckCircle weight="fill" />
      <span>{toast.message}</span>
      {toast.actionLabel && <button onClick={toast.onAction}>{toast.actionLabel}</button>}
    </div>
  );
}
