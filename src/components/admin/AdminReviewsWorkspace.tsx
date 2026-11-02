"use client";

import { useState } from "react";

import { formatDate } from "@/lib/format";
import type { AdminReviewRow } from "@/lib/repositories/admin-directories";

type DeleteResponse = { error?: { message?: string } };

export function AdminReviewsWorkspace({
  initialReviews,
}: {
  initialReviews: AdminReviewRow[];
}) {
  const [reviews, setReviews] = useState(initialReviews);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function deleteReview(review: AdminReviewRow) {
    const confirmed = window.confirm(
      `Delete this ${review.rating}-star review for "${review.campaignName}"? This removes the review permanently.`,
    );
    if (!confirmed) return;

    setError("");
    setSuccess("");
    setDeletingId(review.reviewId);
    try {
      const response = await fetch(`/api/admin/reviews/${review.reviewId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = (await response.json()) as DeleteResponse;
        throw new Error(payload.error?.message ?? "The review could not be deleted.");
      }
      setReviews((current) => current.filter((entry) => entry.reviewId !== review.reviewId));
      setSuccess("Review deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "The review could not be deleted.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {success ? <p className="form-success" role="status">{success}</p> : null}
      <p className="panel-note">
        The reviews schema does not record reviewer identity; the participants and campaign shown here identify only the reviewed collaboration.
      </p>
      {reviews.length === 0 ? (
        <p className="empty-note">No reviews found.</p>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <caption className="sr-only">Platform reviews</caption>
            <thead>
              <tr>
                <th scope="col">Rating</th>
                <th scope="col">Collaboration</th>
                <th scope="col">Date</th>
                <th scope="col">Feedback</th>
                <th scope="col">Moderation</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((review) => (
                <tr key={review.reviewId}>
                  <td>{review.rating} / 5</td>
                  <td>
                    <strong>{review.campaignName}</strong>
                    <span className="table-subtext">{review.creatorName} · {review.brandName}</span>
                  </td>
                  <td>{formatDate(review.reviewDate)}</td>
                  <td>{review.feedback || "No written feedback"}</td>
                  <td>
                    <button
                      className="btn btn-secondary"
                      type="button"
                      disabled={deletingId !== null}
                      onClick={() => void deleteReview(review)}
                    >
                      {deletingId === review.reviewId ? "Deleting…" : "Delete review"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
