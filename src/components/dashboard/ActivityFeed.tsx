import { StatusBadge } from "@/components/dashboard/StatusBadge";
import type { ActivityRecord } from "@/lib/repositories/dashboard-types";
import { formatDate, humanize } from "@/lib/format";

type ActivityFeedProps = {
  items: ActivityRecord[];
  emptyMessage?: string;
};

export function ActivityFeed({
  items,
  emptyMessage = "No recent activity yet.",
}: ActivityFeedProps) {
  if (items.length === 0) {
    return <p className="empty-note">{emptyMessage}</p>;
  }

  return (
    <ul className="activity-list">
      {items.map((item) => (
        <li className="activity-item" key={item.id}>
          <span
            className={`activity-marker activity-${item.type}`}
            aria-hidden="true"
          />
          <div className="activity-body">
            <div className="activity-heading">
              <p>{item.title}</p>
              <StatusBadge status={item.detail} />
            </div>
            <span className="activity-meta">
              {humanize(item.type)} · {formatDate(item.eventDate)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
