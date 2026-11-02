const numberFormatter = new Intl.NumberFormat("en-IN");
const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function toDate(value: string): Date | null {
  if (!value) {
    return null;
  }

  const normalized = value.includes(" ")
    ? `${value.replace(" ", "T")}Z`
    : `${value}T00:00:00Z`;
  const date = new Date(normalized);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatNumber(value: number | string): string {
  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    try {
      return numberFormatter.format(BigInt(value));
    } catch {
      return "0";
    }
  }

  const numeric = Number(value);

  return Number.isFinite(numeric) ? numberFormatter.format(numeric) : "0";
}

export function formatCurrency(value: number | string): string {
  if (typeof value === "string") {
    const decimalMatch = value.match(/^(-?)(\d+)(?:\.(\d+))?$/);
    if (decimalMatch) {
      const [, sign, whole, fraction = ""] = decimalMatch;
      try {
        const roundUp = Number(fraction[0] ?? "0") >= 5;
        const rounded = BigInt(whole) + (roundUp ? 1n : 0n);
        return currencyFormatter.format(sign === "-" ? -rounded : rounded);
      } catch {
        return currencyFormatter.format(0);
      }
    }
  }

  const numeric = Number(value);

  return currencyFormatter.format(Number.isFinite(numeric) ? numeric : 0);
}

export function formatDate(value: string | null): string {
  if (!value) {
    return "Not set";
  }

  const date = toDate(value);
  return date ? dateFormatter.format(date) : "Not set";
}

export function formatPercent(value: number | string): string {
  return `${Number(value).toFixed(2)}%`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "CC";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

export function statusTone(status: string | null | undefined): StatusTone {
  const normalized = status?.toLowerCase() ?? "";

  if (
    ["accepted", "approved", "completed", "paid", "active"].includes(normalized)
  ) {
    return "success";
  }

  if (["pending", "open", "draft", "in progress"].includes(normalized)) {
    return "warning";
  }

  if (["rejected", "cancelled", "failed", "inactive"].includes(normalized)) {
    return "danger";
  }

  if (["reviewed", "submitted", "ongoing"].includes(normalized)) {
    return "info";
  }

  return "neutral";
}

export function humanize(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function displayName(input: {
  creator?: { firstName?: string; lastName?: string } | null;
  brand?: { brandName?: string } | null;
  username: string;
}): string {
  if (input.creator?.firstName) {
    return [input.creator.firstName, input.creator.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
  }

  if (input.brand?.brandName) {
    return input.brand.brandName;
  }

  return input.username;
}
