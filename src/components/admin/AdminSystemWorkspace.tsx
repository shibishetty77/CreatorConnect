"use client";

import { useEffect, useState } from "react";

type SystemStatus = {
  database: string | null;
  version: string | null;
  tables: Array<{ name: string; estimatedRows: number | null }>;
  missingTables: string[];
  triggers: Array<{ name: string; present: boolean }>;
  procedures: Array<{ name: string; present: boolean }>;
  views: Array<{ name: string; present: boolean }>;
};

type SystemResponse = {
  data?: SystemStatus;
  error?: { message?: string };
};

export function AdminSystemWorkspace() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/admin/system/db", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = (await response.json()) as SystemResponse;
        if (!response.ok || !payload.data) {
          throw new Error(payload.error?.message ?? "Database status could not be loaded.");
        }
        setStatus(payload.data);
      })
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : "Database status could not be loaded.");
        }
      });

    return () => controller.abort();
  }, []);

  if (error) {
    return (
      <section className="panel error-panel" role="alert">
        <h2>System status unavailable</h2>
        <p>{error}</p>
        <button className="btn btn-secondary" type="button" onClick={() => window.location.reload()}>
          Try again
        </button>
      </section>
    );
  }

  if (!status) {
    return (
      <div className="dashboard-loading" role="status" aria-busy="true">
        <span className="sr-only">Loading system status</span>
        <div className="skeleton skeleton-heading" />
        <div className="skeleton skeleton-panel" />
      </div>
    );
  }

  const objects = [...status.triggers, ...status.procedures, ...status.views];
  return (
    <>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Database connection</h2>
            <p>Read-only metadata from the current MySQL connection.</p>
          </div>
        </div>
        <dl className="detail-list">
          <div><dt>Database</dt><dd>{status.database ?? "Unavailable"}</dd></div>
          <div><dt>Server version</dt><dd>{status.version ?? "Unavailable"}</dd></div>
          <div><dt>Base tables</dt><dd>{status.tables.length}</dd></div>
          <div><dt>Missing expected tables</dt><dd>{status.missingTables.length}</dd></div>
        </dl>
      </section>

      <div className="panel-grid">
        <section className="panel">
          <div className="panel-header"><div><h2>Schema objects</h2></div></div>
          {objects.length === 0 ? (
            <p className="empty-note">No expected triggers, procedures, or views were found.</p>
          ) : (
            <ul className="status-list">
              {objects.map((object) => (
                <li key={object.name}>
                  <span>{object.name}</span>
                  <strong className={object.present ? "status-present" : "status-missing"}>
                    {object.present ? "Present" : "Missing"}
                  </strong>
                </li>
              ))}
            </ul>
          )}
          {status.missingTables.length > 0 ? (
            <p className="panel-note">Missing tables: {status.missingTables.join(", ")}</p>
          ) : null}
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Table row estimates</h2>
              <p>InnoDB TABLE_ROWS values are estimates, not exact counts.</p>
            </div>
          </div>
          {status.tables.length === 0 ? (
            <p className="empty-note">No tables are visible to the database user.</p>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <caption className="sr-only">Database tables and estimated row counts</caption>
                <thead><tr><th scope="col">Table</th><th scope="col">Estimated rows</th></tr></thead>
                <tbody>
                  {status.tables.map((table) => (
                    <tr key={table.name}>
                      <td>{table.name}</td>
                      <td>{table.estimatedRows === null ? "Unavailable" : table.estimatedRows.toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
