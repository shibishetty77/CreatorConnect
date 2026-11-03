"use client";

import { useEffect, useState } from "react";

import type { ActivityRecord } from "@/lib/repositories/mongo-platform";

type ActivityResponse = {
  data?: { activities: ActivityRecord[] };
  error?: { message?: string };
};

export function PlatformActivityPanel({
  limit = 8,
  title = "Platform event stream",
  description = "Recent activity recorded in MongoDB.",
}: {
  limit?: number;
  title?: string;
  description?: string;
}) {
  const [activities, setActivities] = useState<ActivityRecord[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/activity?limit=${limit}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as ActivityResponse;
        if (!response.ok || !payload.data) {
          throw new Error(payload.error?.message ?? "Activity could not be loaded.");
        }
        setActivities(payload.data.activities);
      })
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Activity could not be loaded.",
          );
        }
      });
    return () => controller.abort();
  }, [limit]);

  return (
    <section className="panel" aria-labelledby="platform-activity-heading">
      <div className="panel-header">
        <div>
          <h2 id="platform-activity-heading">{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      {error ? (
        <div className="error-panel" role="alert">
          <p>{error}</p>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </div>
      ) : activities === null ? (
        <p className="empty-note" role="status">Loading activity…</p>
      ) : activities.length === 0 ? (
        <p className="empty-note">No platform events have been recorded yet.</p>
      ) : (
        <ul className="platform-activity-list">
          {activities.map((activity) => (
            <li key={activity.id} className="platform-activity-item">
              <span className="platform-activity-marker" aria-hidden="true" />
              <div>
                <p>{activity.description}</p>
                <small>
                  {activity.actorRole} #{activity.actorId} ·{" "}
                  {activity.action.replaceAll("_", " ")} ·{" "}
                  {new Date(activity.createdAt).toLocaleString()}
                </small>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
