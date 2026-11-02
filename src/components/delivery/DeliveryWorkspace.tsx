"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { formatDate } from "@/lib/format";
import type { CollaborationRecord } from "@/lib/repositories/collaborations";
import type {
  DeliverableContentType,
  DeliverableRecord,
  SubmissionApprovalStatus,
} from "@/lib/repositories/delivery";

type WorkspaceRole = "creator" | "brand";

type WorkspaceResponse = {
  data?: {
    deliverables: DeliverableRecord[];
    collaborations?: CollaborationRecord[];
  };
  error?: { message: string };
};

type MutationResponse = {
  data?: unknown;
  error?: { message: string };
};

const contentTypes: DeliverableContentType[] = [
  "Reel",
  "Story",
  "Post",
  "Video",
];

function isHttpUrl(value: string | null): value is string {
  if (!value) return false;
  try {
    const protocol = new URL(value).protocol;
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

export function DeliveryWorkspace({ role }: { role: WorkspaceRole }) {
  const [deliverables, setDeliverables] = useState<DeliverableRecord[]>([]);
  const [collaborations, setCollaborations] = useState<CollaborationRecord[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(new Set<string>());

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const response = await fetch(`/api/${role}/deliverables`, {
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as
          | WorkspaceResponse
          | null;
        if (!response.ok || !Array.isArray(payload?.data?.deliverables)) {
          throw new Error(
            payload?.error?.message ?? "We could not load deliverables.",
          );
        }
        setDeliverables(payload.data.deliverables);
        setCollaborations(payload.data.collaborations ?? []);
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "We could not load deliverables.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => controller.abort();
  }, [retry, role]);

  async function mutate(
    key: string,
    url: string,
    method: "POST" | "PATCH" | "DELETE",
    body?: unknown,
  ): Promise<boolean> {
    if (inFlight.current.has(key)) return false;
    inFlight.current.add(key);
    setBusy(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const response = await fetch(url, {
        method,
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => null)) as
        | MutationResponse
        | null;
      if (!response.ok || !payload?.data) {
        throw new Error(
          payload?.error?.message ?? "We could not save this change.",
        );
      }
      setActionSuccess("Changes saved.");
      setRetry((value) => value + 1);
      return true;
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "We could not save this change.",
      );
      return false;
    } finally {
      inFlight.current.delete(key);
      setBusy(inFlight.current.size > 0);
    }
  }

  function createDeliverable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const collaborationId = String(formData.get("collaborationId") ?? "");
    const contentType = String(formData.get("contentType") ?? "");
    const dueDate = String(formData.get("dueDate") ?? "");
    void mutate(
      `create-${collaborationId}`,
      `/api/brand/collaborations/${collaborationId}/deliverables`,
      "POST",
      { contentType, dueDate },
    ).then((saved) => {
      if (saved) form.reset();
    });
  }

  function updateDeliverable(
    event: FormEvent<HTMLFormElement>,
    deliverable: DeliverableRecord,
  ) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    void mutate(
      `update-${deliverable.deliverableId}`,
      `/api/brand/deliverables/${deliverable.deliverableId}`,
      "PATCH",
      {
        contentType: String(formData.get("contentType") ?? ""),
        dueDate: String(formData.get("dueDate") ?? ""),
      },
    );
  }

  function submitContent(
    event: FormEvent<HTMLFormElement>,
    deliverable: DeliverableRecord,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    void mutate(
      `submit-${deliverable.deliverableId}`,
      `/api/creator/deliverables/${deliverable.deliverableId}/submissions`,
      "POST",
      { contentUrl: String(formData.get("contentUrl") ?? "") },
    ).then((saved) => {
      if (saved) form.reset();
    });
  }

  function reviewSubmission(
    submissionId: number,
    approvalStatus: Extract<SubmissionApprovalStatus, "Approved" | "Rejected">,
  ) {
    void mutate(
      `review-${submissionId}`,
      `/api/brand/submissions/${submissionId}/review`,
      "POST",
      { approvalStatus },
    );
  }

  const pendingCount = deliverables.filter(
    (deliverable) => deliverable.status === "Pending",
  ).length;
  const completedCount = deliverables.length - pendingCount;

  if (loading) {
    return <section className="panel" role="status">Loading delivery workspace…</section>;
  }

  if (loadError) {
    return (
      <section className="panel error-panel" role="alert">
        <h2>Delivery workspace could not be loaded</h2>
        <p>{loadError}</p>
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => setRetry((value) => value + 1)}
        >
          Try again
        </button>
      </section>
    );
  }

  const activeCollaborations = collaborations.filter(
    (collaboration) => collaboration.status === "Active",
  );

  return (
    <div className="form-stack">
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Delivery progress</h2>
            <p>
              {pendingCount} pending · {completedCount} completed
            </p>
          </div>
        </div>
        {actionError ? <p className="form-error" role="alert">{actionError}</p> : null}
        {actionSuccess ? <p className="form-success" role="status">{actionSuccess}</p> : null}
      </section>

      {role === "brand" ? (
        <form className="panel form-stack" onSubmit={createDeliverable}>
          <h2>Add a deliverable</h2>
          {activeCollaborations.length === 0 ? (
            <p>No active collaborations are available for new deliverables.</p>
          ) : (
            <>
              <div className="field">
                <label className="field-label" htmlFor="new-deliverable-collaboration">
                  Collaboration
                </label>
                <select
                  id="new-deliverable-collaboration"
                  name="collaborationId"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>Select a collaboration</option>
                  {activeCollaborations.map((collaboration) => (
                    <option
                      key={collaboration.collaborationId}
                      value={collaboration.collaborationId}
                    >
                      {collaboration.campaignName} — {collaboration.creatorName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="new-deliverable-type">
                  Content type
                </label>
                <select id="new-deliverable-type" name="contentType" required>
                  {contentTypes.map((contentType) => (
                    <option key={contentType} value={contentType}>{contentType}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="new-deliverable-date">
                  Due date
                </label>
                <input id="new-deliverable-date" name="dueDate" type="date" required />
              </div>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                Add deliverable
              </button>
            </>
          )}
        </form>
      ) : null}

      {deliverables.length === 0 ? (
        <section className="panel">
          <p className="empty-note">
            {role === "creator"
              ? "Deliverables from your active collaborations will appear here."
              : "Your collaborations do not have any deliverables yet."}
          </p>
        </section>
      ) : (
        <div className="panel-grid">
          {deliverables.map((deliverable) => {
            const latestSubmission =
              deliverable.submissions[deliverable.submissions.length - 1];
            const pendingSubmission = deliverable.submissions.find(
              (submission) => submission.approvalStatus === "Pending",
            );
            return (
              <article className="panel" key={deliverable.deliverableId}>
                <header className="panel-header">
                  <div>
                    <h2>{deliverable.campaignName}</h2>
                    <p>
                      {deliverable.contentType ?? "Content type not set"} ·{" "}
                      {role === "creator"
                        ? deliverable.brandName
                        : `${deliverable.creatorName} (@${deliverable.creatorUsername})`}
                    </p>
                  </div>
                  <StatusBadge status={deliverable.status} />
                </header>
                <dl className="campaign-facts">
                  <div>
                    <dt>Due date</dt>
                    <dd>{formatDate(deliverable.dueDate)}</dd>
                  </div>
                  <div>
                    <dt>Collaboration</dt>
                    <dd>{deliverable.collaborationStatus}</dd>
                  </div>
                  <div>
                    <dt>Submissions</dt>
                    <dd>{deliverable.submissions.length}</dd>
                  </div>
                </dl>

                {role === "brand" && deliverable.status === "Pending" ? (
                  <form
                    className="form-stack"
                    onSubmit={(event) => updateDeliverable(event, deliverable)}
                  >
                    <h3>Manage deliverable</h3>
                    <div className="field">
                      <label
                        className="field-label"
                        htmlFor={`type-${deliverable.deliverableId}`}
                      >
                        Content type
                      </label>
                      <select
                        id={`type-${deliverable.deliverableId}`}
                        name="contentType"
                        defaultValue={deliverable.contentType ?? "Reel"}
                      >
                        {contentTypes.map((contentType) => (
                          <option key={contentType} value={contentType}>{contentType}</option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label
                        className="field-label"
                        htmlFor={`due-${deliverable.deliverableId}`}
                      >
                        Due date
                      </label>
                      <input
                        id={`due-${deliverable.deliverableId}`}
                        name="dueDate"
                        type="date"
                        required
                        defaultValue={deliverable.dueDate ?? ""}
                      />
                    </div>
                    <div className="page-actions">
                      <button className="btn btn-secondary" type="submit" disabled={busy}>
                        Save changes
                      </button>
                      {deliverable.submissions.length === 0 ? (
                        <button
                          className="btn btn-secondary"
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            void mutate(
                              `delete-${deliverable.deliverableId}`,
                              `/api/brand/deliverables/${deliverable.deliverableId}`,
                              "DELETE",
                            );
                          }}
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </form>
                ) : null}

                <section>
                  <h3>Submission history</h3>
                  {deliverable.submissions.length === 0 ? (
                    <p>No work has been submitted yet.</p>
                  ) : (
                    <ol className="form-stack">
                      {deliverable.submissions.map((submission) => (
                        <li key={submission.submissionId}>
                          {isHttpUrl(submission.contentUrl) ? (
                            <a
                              href={submission.contentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              referrerPolicy="no-referrer"
                            >
                              View submission
                            </a>
                          ) : submission.contentUrl ? (
                            <span>Untrusted submission link: {submission.contentUrl}</span>
                          ) : (
                            <span>No content URL stored</span>
                          )}{" "}
                          · submitted {formatDate(submission.submittedDate)} ·{" "}
                          <StatusBadge status={submission.approvalStatus} />
                          {role === "brand" &&
                          submission.approvalStatus === "Pending" ? (
                            <div className="page-actions">
                              <button
                                className="btn btn-primary"
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  reviewSubmission(
                                    submission.submissionId,
                                    "Approved",
                                  )
                                }
                              >
                                Approve
                              </button>
                              <button
                                className="btn btn-secondary"
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  reviewSubmission(
                                    submission.submissionId,
                                    "Rejected",
                                  )
                                }
                              >
                                Request revision
                              </button>
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  )}
                </section>

                {role === "creator" && deliverable.status === "Pending" ? (
                  latestSubmission?.approvalStatus === "Pending" ? (
                    <p role="status">Your latest submission is awaiting brand review.</p>
                  ) : latestSubmission?.approvalStatus === "Approved" ? (
                    <p role="status">
                      An approved submission is on record for this deliverable.
                    </p>
                  ) : deliverable.collaborationStatus !== "Active" ? (
                    <p>Submissions are closed for this completed collaboration.</p>
                  ) : (
                    <form
                      className="form-stack"
                      onSubmit={(event) => submitContent(event, deliverable)}
                    >
                      <h3>
                        {latestSubmission?.approvalStatus === "Rejected"
                          ? "Submit revised work"
                          : "Submit your work"}
                      </h3>
                      {latestSubmission?.approvalStatus === "Rejected" ? (
                        <p>The previous submission was rejected. Submit a revised link for review.</p>
                      ) : null}
                      <div className="field">
                        <label
                          className="field-label"
                          htmlFor={`url-${deliverable.deliverableId}`}
                        >
                          Content URL
                        </label>
                        <input
                          id={`url-${deliverable.deliverableId}`}
                          name="contentUrl"
                          type="url"
                          maxLength={500}
                          required
                          placeholder="https://…"
                        />
                      </div>
                      <button className="btn btn-primary" type="submit" disabled={busy}>
                        Submit for review
                      </button>
                    </form>
                  )
                ) : null}

                {role === "brand" && pendingSubmission ? (
                  <p className="page-eyebrow">Awaiting your review</p>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
