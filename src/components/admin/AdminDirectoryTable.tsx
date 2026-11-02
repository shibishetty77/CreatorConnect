import type { ReactNode } from "react";

export type DirectoryColumn = { label: string; key: string };
export type DirectoryRow = { key: string; cells: ReactNode[] };

export function AdminDirectoryTable({
  caption,
  columns,
  rows,
  emptyMessage,
}: {
  caption: string;
  columns: DirectoryColumn[];
  rows: DirectoryRow[];
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return <p className="empty-note">{emptyMessage}</p>;
  }

  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>{columns.map((column) => <th key={column.key} scope="col">{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              {row.cells.map((cell, index) => <td key={`${row.key}-${index}`}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
