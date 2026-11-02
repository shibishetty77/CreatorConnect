import type { Metadata } from "next";
import Link from "next/link";

import { AdminDirectoryFilters } from "@/components/admin/AdminDirectoryFilters";
import { AdminDirectoryTable } from "@/components/admin/AdminDirectoryTable";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { requireRole } from "@/lib/auth/guards";
import { formatDate } from "@/lib/format";
import { listAdminUsers } from "@/lib/repositories/admin-directories";

export const metadata: Metadata = {
  title: "Admin users",
};

type PageProps = { searchParams: Promise<{ q?: string; role?: string }> };

export default async function AdminUsersPage({ searchParams }: PageProps) {
  await requireRole("Admin");
  const params = await searchParams;
  const search = params.q?.slice(0, 100) ?? "";
  const role = params.role ?? "";
  const users = await listAdminUsers({ search, role });

  return (
    <>
      <PageHeader eyebrow="Account directory" title="Users" description="Read-only account search. Sensitive account fields are intentionally omitted." />
      <section className="panel">
        <AdminDirectoryFilters
          action="/admin/users"
          search={search}
          searchLabel="Username"
          filterName="role"
          filterLabel="Role"
          filterValue={role}
          filterOptions={[
            { value: "", label: "All roles" },
            { value: "Creator", label: "Creator" },
            { value: "Brand", label: "Brand" },
            { value: "Admin", label: "Admin" },
          ]}
        />
      </section>
      <section className="panel">
        <p className="panel-note">Showing up to 100 newest matching accounts.</p>
        <AdminDirectoryTable
          caption="Platform users"
          columns={[
            { key: "username", label: "Username" },
            { key: "role", label: "Role" },
            { key: "created", label: "Created" },
          ]}
          rows={users.map((user) => ({
            key: String(user.userId),
            cells: [
              <Link href={`/admin/users/${user.userId}`} key={`user-${user.userId}`}>{user.username}</Link>,
              <StatusBadge key={user.role} status={user.role} />,
              formatDate(user.createdAt),
            ],
          }))}
          emptyMessage="No users found."
        />
      </section>
    </>
  );
}
