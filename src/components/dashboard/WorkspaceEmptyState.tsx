import type { ReactNode } from "react";

type WorkspaceEmptyStateProps = {
  title: string;
  description: string;
  detail?: string;
  action?: ReactNode;
};

export function WorkspaceEmptyState({
  title,
  description,
  detail,
  action,
}: WorkspaceEmptyStateProps) {
  return (
    <section className="panel workspace-empty-state">
      <span className="workspace-empty-mark" aria-hidden="true">
        —
      </span>
      <div className="workspace-empty-copy">
        <h2>{title}</h2>
        <p>{description}</p>
        {detail ? <p className="workspace-empty-detail">{detail}</p> : null}
        {action ? <div className="workspace-empty-action">{action}</div> : null}
      </div>
    </section>
  );
}
