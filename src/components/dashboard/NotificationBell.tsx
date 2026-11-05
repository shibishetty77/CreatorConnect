"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import type { Role } from "@/lib/auth/constants";
import type { NotificationRecord } from "@/lib/repositories/mongo-platform";

type NotificationResponse = {
  data?: { notifications: NotificationRecord[]; unreadCount: number };
  error?: { message?: string };
};

function notificationHref(notification: NotificationRecord, role: Role): string {
  const id = notification.relatedEntityId;
  if (notification.relatedEntityType === "collaboration" && id) {
    return `/${role.toLowerCase()}/collaborations/${encodeURIComponent(String(id))}`;
  }
  if (notification.relatedEntityType === "application") {
    return role === "Admin"
      ? "/admin/campaigns"
      : role === "Brand"
        ? "/brand/applications"
        : "/creator/applications";
  }
  if (notification.relatedEntityType === "deliverable") {
    return role === "Admin"
      ? "/admin/collaborations"
      : role === "Brand"
        ? "/brand/deliverables"
        : "/creator/deliverables";
  }
  if (notification.relatedEntityType === "payment") {
    return role === "Admin"
      ? "/admin/payments"
      : role === "Brand"
        ? "/brand/payments"
        : "/creator/payments";
  }
  return `/${role.toLowerCase()}/dashboard`;
}

export function NotificationBell({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      const payload = (await response.json()) as NotificationResponse;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Notifications could not be loaded.");
      }
      setNotifications(payload.data.notifications);
      setUnreadCount(payload.data.unreadCount);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Notifications could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
    const interval = window.setInterval(() => void loadNotifications(), 60_000);
    return () => window.clearInterval(interval);
  }, [loadNotifications]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function markAllRead() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/notifications/read-all", {
        method: "POST",
      });
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Notifications could not be updated.");
      }
      setNotifications((items) => items.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Notifications could not be updated.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function markRead(id: string) {
    const response = await fetch(`/api/notifications/${encodeURIComponent(id)}`, {
      method: "PATCH",
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      throw new Error(payload?.error?.message ?? "Notification could not be updated.");
    }
    setNotifications((items) =>
      items.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
    );
    setUnreadCount((count) => Math.max(0, (count ?? 0) - 1));
  }

  return (
    <div className="notification-menu" ref={menuRef}>
      <button
        className="notification-trigger"
        ref={triggerRef}
        type="button"
        aria-label={
          unreadCount === null
            ? "Notifications"
            : `Notifications, ${unreadCount} unread`
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls="notification-popover"
        onClick={() => setOpen((value) => !value)}
      >
        <svg
          aria-hidden="true"
          fill="none"
          height="21"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
          viewBox="0 0 24 24"
          width="21"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
        {unreadCount ? (
          <span className="notification-count">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <section
          className="notification-popover"
          id="notification-popover"
          role="dialog"
          aria-label="Notifications"
        >
          <header className="notification-heading">
            <div className="notification-heading-title">
              <h2>Notifications</h2>
              <span className="notification-unread-badge">
                {unreadCount ?? 0} unread
              </span>
            </div>
            <button
              className="notification-mark-all"
              type="button"
              disabled={saving || unreadCount === 0}
              onClick={() => void markAllRead()}
            >
              {saving ? "Saving…" : "Mark all read"}
            </button>
          </header>
          {error ? (
            <div className="notification-error" role="alert">
              <p>{error}</p>
              <button type="button" onClick={() => void loadNotifications()}>
                Try again
              </button>
            </div>
          ) : loading ? (
            <p className="notification-state" role="status">
              Loading notifications…
            </p>
          ) : notifications.length === 0 ? (
            <div className="notification-state notification-empty">
              <span className="notification-empty-icon" aria-hidden="true">
                <svg
                  fill="none"
                  height="22"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                  viewBox="0 0 24 24"
                  width="22"
                >
                  <path d="m5 13 4 4L19 7" />
                </svg>
              </span>
              <strong>You’re all caught up</strong>
              <span>New notifications will appear here.</span>
            </div>
          ) : (
            <ul className="notification-list">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <Link
                    className={`notification-item${notification.isRead ? "" : " is-unread"}`}
                    href={notificationHref(notification, role)}
                    onClick={(event) => {
                      if (notification.isRead) return;
                      event.preventDefault();
                      void markRead(notification.id)
                        .then(() => {
                          window.location.assign(notificationHref(notification, role));
                        })
                        .catch((markError: unknown) =>
                          setError(
                            markError instanceof Error
                              ? markError.message
                              : "Notification could not be updated.",
                          ),
                        );
                    }}
                  >
                    <span className="notification-item-title">
                      {notification.title}
                    </span>
                    <span className="notification-item-message">
                      {notification.message}
                    </span>
                    <time
                      className="notification-item-time"
                      dateTime={notification.createdAt.toString()}
                    >
                      {new Date(notification.createdAt).toLocaleString()}
                    </time>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
