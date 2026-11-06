"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { LogoutButton } from "@/components/auth/LogoutButton";
import { NavIcon } from "@/components/dashboard/NavIcon";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import { StudioWallpaper } from "@/components/dashboard/StudioWallpaper";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import type { Role } from "@/lib/auth/constants";
import { initials } from "@/lib/format";
import {
  activeNavigationHref,
  type NavItem,
} from "@/lib/navigation";

type DashboardShellProps = {
  role: Role;
  userId: number;
  name: string;
  email: string;
  navItems: NavItem[];
  children: ReactNode;
};

const workspaceLabels: Record<Role, string> = {
  Creator: "Creator workspace",
  Brand: "Brand workspace",
  Admin: "Admin workspace",
};

export function DashboardShell({
  role,
  userId,
  name,
  email,
  navItems,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const activeHref = activeNavigationHref(navItems, pathname);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <aside
        className={`app-sidebar${open ? " is-open" : ""}`}
        id="app-sidebar"
      >
        <div className="app-sidebar-inner">
          <div className="sidebar-brand-row">
            <Link className="sidebar-brand" href="/" aria-label="CreatorConnect home">
              <span className="brand-mark">CC</span>
              <span>
                <strong>CreatorConnect</strong>
                <small>{workspaceLabels[role]}</small>
              </span>
            </Link>
            <button
              className="sidebar-close"
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close navigation"
            >
              <svg
                aria-hidden="true"
                fill="none"
                height="20"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="20"
              >
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          <nav className="sidebar-nav" aria-label={`${role} navigation`}>
            <span className="sidebar-section-label">Workspace</span>
            {navItems.map((item) => {
              const active = item.href === activeHref;

              return (
                <Link
                  className={`sidebar-link${active ? " is-active" : ""}`}
                  href={item.href}
                  key={item.href}
                  aria-current={active ? "page" : undefined}
                >
                  <NavIcon name={item.icon} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="sidebar-footer">
            <div className="sidebar-user">
              <span className="sidebar-avatar" aria-hidden="true">
                {initials(name)}
              </span>
              <span className="sidebar-user-meta">
                <strong>{name}</strong>
                <small>{email}</small>
              </span>
            </div>
            <span className="role-badge">{role}</span>
            <LogoutButton />
          </div>
        </div>
      </aside>

      {open ? (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div className="app-content">
        <StudioWallpaper />
        <header className="app-topbar">
          <button
            className="mobile-menu-button"
            type="button"
            aria-controls="app-sidebar"
            aria-expanded={open}
            aria-label="Open navigation"
            onClick={() => setOpen(true)}
          >
            <svg
              aria-hidden="true"
              fill="none"
              height="22"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="22"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>

          <div className="topbar-context">
            <span>{workspaceLabels[role]}</span>
            <small>CreatorConnect</small>
          </div>

          <NotificationBell key={userId} role={role} />
          <ThemeToggle />

          <div className="topbar-user">
            <span className="topbar-avatar" aria-hidden="true">
              {initials(name)}
            </span>
            <span>
              <strong>{name}</strong>
              <small>{role}</small>
            </span>
          </div>
        </header>

        <main className="app-main" id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
