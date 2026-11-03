"use client";

import { useEffect, useState, type FormEvent } from "react";

import type { Role } from "@/lib/auth/constants";
import type {
  MessageAttachment,
  MessageRecord,
} from "@/lib/repositories/mongo-platform";

type MessagesResponse = {
  data?: { messages?: MessageRecord[]; message?: MessageRecord };
  error?: { message?: string };
};

export function CollaborationMessages({
  collaborationId,
  role,
}: {
  collaborationId: number;
  role: Extract<Role, "Creator" | "Brand">;
}) {
  const [messages, setMessages] = useState<MessageRecord[] | null>(null);
  const [message, setMessage] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentName, setAttachmentName] = useState("");
  const [attachmentContentType, setAttachmentContentType] = useState("");
  const [attachmentSize, setAttachmentSize] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endpoint = `/api/collaborations/${collaborationId}/messages`;

  async function loadMessages(signal?: AbortSignal) {
    setError("");
    try {
      const response = await fetch(endpoint, { cache: "no-store", signal });
      const payload = (await response.json()) as MessagesResponse;
      if (!response.ok || !payload.data?.messages) {
        throw new Error(payload.error?.message ?? "Messages could not be loaded.");
      }
      setMessages(payload.data.messages);
    } catch (loadError) {
      if (!signal?.aborted) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Messages could not be loaded.",
        );
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void loadMessages(controller.signal);
    return () => controller.abort();
  }, [endpoint]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError("");
    const attachments: MessageAttachment[] = attachmentUrl.trim()
      ? [
          {
            url: attachmentUrl.trim(),
            name: attachmentName.trim(),
            contentType: attachmentContentType.trim(),
            size: Number(attachmentSize),
          },
        ]
      : [];
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, attachments }),
      });
      const payload = (await response.json()) as MessagesResponse;
      if (!response.ok || !payload.data?.message) {
        throw new Error(payload.error?.message ?? "Message could not be sent.");
      }
      setMessages((items) => [...(items ?? []), payload.data!.message!]);
      setMessage("");
      setAttachmentUrl("");
      setAttachmentName("");
      setAttachmentContentType("");
      setAttachmentSize("");
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Message could not be sent.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="panel collaboration-messages" aria-labelledby="messages-heading">
      <header className="panel-header">
        <div>
          <h2 id="messages-heading">Collaboration messages</h2>
          <p>Private conversation between the creator and brand.</p>
        </div>
      </header>
      {error ? (
        <div className="form-error" role="alert">
          <p>{error}</p>
          {messages === null ? (
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => void loadMessages()}
            >
              Try again
            </button>
          ) : null}
        </div>
      ) : null}
      {messages === null ? (
        <p className="empty-note" role="status">Loading conversation…</p>
      ) : messages.length === 0 ? (
        <p className="empty-note">No messages yet. Start the conversation below.</p>
      ) : (
        <ol className="message-list" aria-live="polite">
          {messages.map((item) => (
            <li
              className={`message-bubble${item.senderRole === role ? " is-own" : ""}`}
              key={item.id}
            >
              <div className="message-meta">
                <strong>{item.senderRole === role ? "You" : item.senderRole}</strong>
                <time dateTime={String(item.createdAt)}>
                  {new Date(String(item.createdAt)).toLocaleString()}
                </time>
              </div>
              {item.message ? <p>{item.message}</p> : null}
              {item.attachments.map((attachment) => (
                <a
                  className="message-attachment"
                  href={attachment.url}
                  key={`${attachment.url}-${attachment.name}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  {attachment.name} <small>({attachment.contentType}, {attachment.size.toLocaleString()} bytes)</small>
                </a>
              ))}
            </li>
          ))}
        </ol>
      )}
      <form className="message-form" onSubmit={(event) => void sendMessage(event)}>
        <label className="field">
          <span className="field-label">Message</span>
          <textarea
            maxLength={2000}
            rows={3}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Write a message…"
          />
        </label>
        <details className="message-attachment-fields">
          <summary>Add attachment link</summary>
          <div className="message-attachment-grid">
            <label className="field">
              <span className="field-label">HTTPS attachment URL</span>
              <input
                type="url"
                maxLength={2048}
                value={attachmentUrl}
                onChange={(event) => setAttachmentUrl(event.target.value)}
                placeholder="https://…"
              />
            </label>
            <label className="field">
              <span className="field-label">File name</span>
              <input
                type="text"
                maxLength={180}
                value={attachmentName}
                onChange={(event) => setAttachmentName(event.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">Content type</span>
              <input
                type="text"
                maxLength={120}
                value={attachmentContentType}
                onChange={(event) => setAttachmentContentType(event.target.value)}
                placeholder="application/pdf"
              />
            </label>
            <label className="field">
              <span className="field-label">Size in bytes (max 25 MB)</span>
              <input
                type="number"
                min={1}
                max={25_000_000}
                step={1}
                value={attachmentSize}
                onChange={(event) => setAttachmentSize(event.target.value)}
              />
            </label>
          </div>
          <p className="panel-note">Files are not uploaded by CreatorConnect; only link metadata is stored.</p>
        </details>
        <button className="btn btn-primary" type="submit" disabled={sending}>
          {sending ? "Sending…" : "Send message"}
        </button>
      </form>
    </section>
  );
}
