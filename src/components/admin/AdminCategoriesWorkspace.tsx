"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

type Category = { categoryId: number; categoryName: string };
type CategoryResponse = {
  data?: { categories?: Category[]; category?: Category; deleted?: boolean };
  error?: { message?: string };
};

async function readError(response: Response): Promise<string> {
  const payload = (await response.json()) as CategoryResponse;
  return payload.error?.message ?? "The category operation failed.";
}

export function AdminCategoriesWorkspace() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadCategories(signal?: AbortSignal) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/categories", {
        cache: "no-store",
        signal,
      });
      const payload = (await response.json()) as CategoryResponse;
      if (!response.ok || !payload.data?.categories) {
        throw new Error(payload.error?.message ?? "Categories could not be loaded.");
      }
      setCategories(payload.data.categories);
    } catch (loadError) {
      if (!signal?.aborted) {
        setError(loadError instanceof Error ? loadError.message : "Categories could not be loaded.");
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void loadCategories(controller.signal);
    return () => controller.abort();
  }, []);

  async function submitCategory(
    event: FormEvent<HTMLFormElement>,
    name: string,
    categoryId?: number,
  ) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const response = await fetch(
        categoryId === undefined
          ? "/api/admin/categories"
          : `/api/admin/categories/${categoryId}`,
        {
          method: categoryId === undefined ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categoryName: name }),
        },
      );
      if (!response.ok) throw new Error(await readError(response));
      setSuccess(categoryId === undefined ? "Category created." : "Category renamed.");
      setNewName("");
      setEditingId(null);
      setEditingName("");
      await loadCategories();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The category could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCategory(category: Category) {
    const confirmed = window.confirm(
      `Delete "${category.categoryName}"? This is only allowed when no campaign uses it.`,
    );
    if (!confirmed) return;

    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/categories/${category.categoryId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(await readError(response));
      setSuccess("Category deleted.");
      await loadCategories();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "The category could not be deleted.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {success ? <p className="form-success" role="status">{success}</p> : null}
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Add category</h2>
            <p>Category names are unique. Campaigns may be left uncategorized.</p>
          </div>
        </div>
        <form className="inline-form" onSubmit={(event) => void submitCategory(event, newName)}>
          <label className="field">
            <span className="field-label">Category name</span>
            <input
              maxLength={100}
              required
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Add category"}
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div><h2>Configured categories</h2></div>
        </div>
        {loading ? (
          <div className="skeleton skeleton-panel" role="status" aria-label="Loading categories" />
        ) : categories.length === 0 ? (
          <div className="empty-note">
            <p>No categories configured.</p>
            <span>Add the first category above to classify campaigns.</span>
          </div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <caption className="sr-only">Campaign categories</caption>
              <thead><tr><th scope="col">Category</th><th scope="col">Actions</th></tr></thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.categoryId}>
                    <td>
                      {editingId === category.categoryId ? (
                        <form
                          className="inline-form"
                          onSubmit={(event) => void submitCategory(event, editingName, category.categoryId)}
                        >
                          <label className="sr-only" htmlFor={`category-${category.categoryId}`}>Rename category</label>
                          <input
                            id={`category-${category.categoryId}`}
                            maxLength={100}
                            required
                            value={editingName}
                            onChange={(event) => setEditingName(event.target.value)}
                          />
                          <button className="btn btn-primary" type="submit" disabled={saving}>Save</button>
                          <button className="btn btn-secondary" type="button" onClick={() => setEditingId(null)}>Cancel</button>
                        </form>
                      ) : (
                        <strong>{category.categoryName}</strong>
                      )}
                    </td>
                    <td>
                      {editingId === category.categoryId ? null : (
                        <div className="page-actions">
                          <button
                            className="btn btn-secondary"
                            type="button"
                            disabled={saving}
                            onClick={() => {
                              setEditingId(category.categoryId);
                              setEditingName(category.categoryName);
                            }}
                          >
                            Rename
                          </button>
                          <button
                            className="btn btn-secondary"
                            type="button"
                            disabled={saving}
                            onClick={() => void deleteCategory(category)}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
