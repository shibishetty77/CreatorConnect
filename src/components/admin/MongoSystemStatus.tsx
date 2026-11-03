"use client";

import { useEffect, useState } from "react";

type MongoStatus = { database: string; version: string };
type MongoResponse = {
  data?: MongoStatus;
  error?: { message?: string };
};

export function MongoSystemStatus() {
  const [status, setStatus] = useState<MongoStatus | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/admin/system/mongodb", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as MongoResponse;
        if (!response.ok || !payload.data) {
          throw new Error(payload.error?.message ?? "MongoDB status is unavailable.");
        }
        setStatus(payload.data);
      })
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "MongoDB status is unavailable.",
          );
        }
      });
    return () => controller.abort();
  }, []);

  return (
    <section className="panel" aria-labelledby="mongodb-status-heading">
      <div className="panel-header">
        <div>
          <h2 id="mongodb-status-heading">MongoDB connection</h2>
          <p>Server-side connection status and collection initialization.</p>
        </div>
      </div>
      {error ? (
        <p className="form-error" role="alert">{error}</p>
      ) : status ? (
        <dl className="detail-list">
          <div><dt>Database</dt><dd>{status.database}</dd></div>
          <div><dt>Server version</dt><dd>{status.version}</dd></div>
          <div><dt>Connection</dt><dd>Connected</dd></div>
        </dl>
      ) : (
        <p className="empty-note" role="status">Checking MongoDB connection…</p>
      )}
    </section>
  );
}
