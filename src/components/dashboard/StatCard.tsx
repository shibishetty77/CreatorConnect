import type { ReactNode } from "react";

type StatCardProps = {
  metricKey: string;
  label: string;
  value: string | number;
  rawValue?: string | number;
  hint?: string;
  tone?: "default" | "brand" | "success" | "warning" | "danger";
  icon?: ReactNode;
};

export function StatCard({
  metricKey,
  label,
  value,
  rawValue,
  hint,
  tone = "default",
  icon,
}: StatCardProps) {
  return (
    <div
      className={`stat-card stat-card-${tone}`}
      data-metric={metricKey}
      data-value={rawValue ?? value}
    >
      <div className="stat-card-top">
        <span className="stat-label">{label}</span>
        {icon ? <span className="stat-icon">{icon}</span> : null}
      </div>
      <strong className="stat-value">{value}</strong>
      {hint ? <span className="stat-hint">{hint}</span> : null}
    </div>
  );
}
