export type ActivityRecord = {
  id: string;
  type: string;
  eventDate: string;
  title: string;
  detail: string;
};

export type StatusCount = {
  total: number;
  byStatus: Record<string, number>;
};

export function emptyStatusCount(): StatusCount {
  return { total: 0, byStatus: {} };
}

export function statusCount(
  rows: Array<{ status: string; count: number | string }>,
): StatusCount {
  const byStatus: Record<string, number> = {};
  let total = 0;

  for (const row of rows) {
    const count = Number(row.count);
    byStatus[row.status] = count;
    total += count;
  }

  return { total, byStatus };
}

export function statusValue(
  count: StatusCount,
  ...statuses: string[]
): number {
  return statuses.reduce(
    (sum, status) => sum + (count.byStatus[status] ?? 0),
    0,
  );
}
