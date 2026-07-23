"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Bell,
  ChartBar,
  CheckCircle,
  GearSix,
  GraduationCap,
  House,
  ListChecks,
  List as MenuIcon,
  Moon,
  Sparkle,
  SquaresFour,
  Sun,
  X,
  CalendarDots,
  ArrowRight,
} from "@phosphor-icons/react";
import { AccountMenu } from "@/components/auth/account-menu";
import { useOptionalAuth } from "@/components/auth/auth-provider";
import { Logo } from "@/components/common/logo";
import { useApp } from "@/components/common/app-provider";
import { Badge, ToastRegion } from "@/components/common/ui";

const navItems = [
  { href: "/overview", label: "Overview", icon: SquaresFour },
  { href: "/assignments", label: "Assignments", icon: ListChecks },
  { href: "/canvai", label: "Canvai", icon: Sparkle },
  { href: "/insights", label: "Insights", icon: ChartBar },
  { href: "/settings", label: "Settings", icon: GearSix },
];

const notificationIcons = {
  new: GraduationCap,
  changed: CalendarDots,
  moved: Sparkle,
  missing: Bell,
  resolved: CheckCircle,
  connection: CalendarDots,
};

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const auth = useOptionalAuth();
  const {
    backendMode,
    calendarConnection,
    canvasConnection,
    notifications,
    markAllNotificationsRead,
    dismissNotification,
    theme,
    setTheme,
    showToast,
  } = useApp();
  const [drawer, setDrawer] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  useEffect(() => {
    if (!drawer && !mobileMenu) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDrawer(false);
        setMobileMenu(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawer, mobileMenu]);
  const active = navItems.find((item) => pathname.startsWith(item.href)) ?? navItems[0];
  const unread = notifications.filter((item) => !item.read).length;
  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");
  const canvasLabel = !backendMode
    ? "Demo mode · synced 2m ago"
    : canvasConnection?.connected
      ? `Connected${canvasConnection.last_successful_sync_at ? " · synced" : ""}`
      : canvasConnection?.configured
        ? "Needs attention"
        : "Not configured";
  const canvasTone =
    !backendMode || canvasConnection?.connected
      ? "green"
      : canvasConnection?.configured
        ? "amber"
        : "gray";

  return (
    <div className="app-frame">
      <aside
        className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}
        aria-label="Application navigation"
      >
        <div className="sidebar-mobile-close">
          <button
            className="icon-button"
            onClick={() => setMobileMenu(false)}
            aria-label="Close navigation"
          >
            <X />
          </button>
        </div>
        <Logo subtitle={backendMode ? "Private workspace" : undefined} />
        <div className="canvai-status">
          <span className="canvai-mark">
            <Sparkle weight="fill" />
          </span>
          <span>
            <strong>Canvai</strong>
            <small>Your study planner</small>
          </span>
          <span className="status-ready">
            <i />
            Ready
          </span>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenu(false)}
                className={isActive ? "active" : ""}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon weight={isActive ? "fill" : "regular"} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <span className="sidebar-label">Connections</span>
          <div className="connection-row">
            <GraduationCap />
            <span>
              <strong>Canvas</strong>
              <small>{canvasLabel}</small>
            </span>
            <i className={`dot ${canvasTone}`} />
          </div>
          <div className="connection-row">
            <CalendarDots />
            <span>
              <strong>Google Calendar</strong>
              <small>
                {calendarConnection?.connected
                  ? `Connected${calendarConnection.last_sync_at ? " · synced" : ""}`
                  : "Not connected"}
              </small>
            </span>
            <i className={`dot ${calendarConnection?.connected ? "green" : "gray"}`} />
          </div>
          {auth?.user ? (
            <AccountMenu />
          ) : (
            <button
              className="profile-row"
              onClick={() => showToast("Sign in to manage your profile")}
            >
              <span className="avatar">MK</span>
              <span>
                <strong>Maya Kessler</strong>
                <small>Junior · Demo student</small>
              </span>
            </button>
          )}
        </div>
      </aside>
      {(mobileMenu || drawer) && (
        <button
          className="sheet-backdrop"
          onClick={() => {
            setMobileMenu(false);
            setDrawer(false);
          }}
          aria-label="Close overlay"
        />
      )}
      <div className="app-main">
        <header className="topbar">
          <button
            className="icon-button mobile-only"
            onClick={() => setMobileMenu(true)}
            aria-label="Open navigation"
          >
            <MenuIcon />
          </button>
          <Link className="icon-button desktop-only" href="/" aria-label="Back to landing">
            <House />
          </Link>
          <div className="topbar-title">
            <strong>{active.label}</strong>
            <Badge tone={backendMode ? "success" : "warning"}>
              {backendMode ? "YOUR DATA" : "DEMO DATA"}
            </Badge>
          </div>
          <div className="topbar-actions">
            <span className="canvai-pill desktop-only">
              <Sparkle weight="fill" /> Canvai <i className="dot green" />
            </span>
            <button
              className="icon-button notification-button"
              onClick={() => setDrawer(true)}
              aria-label={`Notifications, ${unread} unread`}
            >
              <Bell />
              {unread > 0 && <span>{unread}</span>}
            </button>
            <button
              className="icon-button"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? <Sun /> : <Moon />}
            </button>
          </div>
        </header>
        <main className="page-content">{children}</main>
        <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={isActive ? "active" : ""}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon weight={isActive ? "fill" : "regular"} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
      <aside
        className={`notification-drawer ${drawer ? "open" : ""}`}
        aria-hidden={!drawer}
        aria-label="Notifications"
      >
        <div className="drawer-header">
          <Bell />
          <h2>Notifications</h2>
          <button onClick={markAllNotificationsRead}>Mark all read</button>
          <button
            className="icon-button"
            onClick={() => setDrawer(false)}
            aria-label="Close notifications"
          >
            <X />
          </button>
        </div>
        <div className="drawer-content">
          {notifications.map((item) => {
            const Icon = notificationIcons[item.kind];
            return (
              <article className={item.read ? "notification read" : "notification"} key={item.id}>
                <span className={`notification-icon ${item.kind}`}>
                  <Icon />
                </span>
                <div>
                  <div>
                    <strong>{item.title}</strong>
                    <time>{item.timeLabel}</time>
                  </div>
                  <p>{item.body}</p>
                  <button
                    onClick={() => {
                      dismissNotification(item.id);
                      showToast("Notification dismissed");
                    }}
                  >
                    Dismiss <ArrowRight />
                  </button>
                </div>
              </article>
            );
          })}
          {!notifications.length && <p className="muted center">You’re all caught up.</p>}
        </div>
        <div className="drawer-note">
          {backendMode
            ? "Notifications are saved to your account."
            : "Demo notifications — actions are simulated."}
        </div>
      </aside>
      <ToastRegion />
    </div>
  );
}
