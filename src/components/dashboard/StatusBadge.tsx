import { humanize, statusTone } from "@/lib/format";

type StatusBadgeProps = {
  status: string;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`status-badge status-${statusTone(status)}`}>
      {humanize(status)}
    </span>
  );
}
