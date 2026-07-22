"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SignOut, UserCircle } from "@phosphor-icons/react";
import { useAuth } from "@/components/auth/auth-provider";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

export function AccountMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!user) return null;
  return (
    <div className="account-menu" ref={root}>
      <button
        className="profile-row"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`${user.display_name} account menu`}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="avatar">{initials(user.display_name) || "U"}</span>
        <span>
          <strong>{user.display_name}</strong>
          <small>{user.email}</small>
        </span>
      </button>
      {open && (
        <div className="account-popover" role="menu">
          <Link role="menuitem" href="/profile" onClick={() => setOpen(false)}>
            <UserCircle /> View profile
          </Link>
          <button role="menuitem" onClick={() => void logout()}>
            <SignOut /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
