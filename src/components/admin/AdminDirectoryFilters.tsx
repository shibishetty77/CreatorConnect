import Link from "next/link";

type FilterOption = { value: string; label: string };

export function AdminDirectoryFilters({
  action,
  search,
  searchLabel = "Search",
  filterName,
  filterLabel,
  filterValue,
  filterOptions,
}: {
  action: string;
  search?: string;
  searchLabel?: string;
  filterName?: string;
  filterLabel?: string;
  filterValue?: string;
  filterOptions?: FilterOption[];
}) {
  return (
    <form className="admin-filter-form" action={action} method="get">
      {searchLabel ? (
        <label className="field">
          <span className="field-label">{searchLabel}</span>
          <input name="q" maxLength={100} defaultValue={search ?? ""} />
        </label>
      ) : null}
      {filterName && filterLabel && filterOptions ? (
        <label className="field">
          <span className="field-label">{filterLabel}</span>
          <select name={filterName} defaultValue={filterValue ?? ""}>
            {filterOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="page-actions">
        <button className="btn btn-primary" type="submit">Filter</button>
        <Link className="btn btn-secondary" href={action}>Clear</Link>
      </div>
    </form>
  );
}
