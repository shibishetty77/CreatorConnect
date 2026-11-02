export function DashboardSkeleton() {
  return (
    <div className="dashboard-loading" role="status" aria-busy="true">
      <span className="sr-only">Loading dashboard</span>
      <div className="skeleton skeleton-heading" />
      <div className="skeleton skeleton-copy" />
      <div className="stats-grid">
        {Array.from({ length: 6 }, (_, index) => (
          <div className="skeleton skeleton-card" key={index} />
        ))}
      </div>
      <div className="panel-grid">
        <div className="skeleton skeleton-panel" />
        <div className="skeleton skeleton-panel" />
      </div>
    </div>
  );
}
