"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import type { BrandProfileRecord } from "@/lib/repositories/brand-profiles";

type BrandProfileFormProps = {
  profile: BrandProfileRecord;
};

type FormValues = {
  brandName: string;
  industry: string;
  contactNumber: string;
  address: string;
  city: string;
  state: string;
};

type ApiErrorBody = {
  error?: {
    message?: string;
    fields?: Record<string, string>;
  };
};

function valuesFromProfile(profile: BrandProfileRecord): FormValues {
  return {
    brandName: profile.brandName,
    industry: profile.industry ?? "",
    contactNumber: profile.contactNumber ?? "",
    address: profile.address ?? "",
    city: profile.city ?? "",
    state: profile.state ?? "",
  };
}

export function BrandProfileForm({ profile }: BrandProfileFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(() =>
    valuesFromProfile(profile),
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateValue(field: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!(field in current)) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    setFieldErrors({});

    try {
      const response = await fetch("/api/brand/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = (await response.json().catch(() => null)) as
        | (ApiErrorBody & { data?: { profile?: BrandProfileRecord } })
        | null;

      if (!response.ok) {
        setFieldErrors(body?.error?.fields ?? {});
        setError(body?.error?.message ?? "We could not save your profile.");
        return;
      }

      if (body?.data?.profile) {
        setValues(valuesFromProfile(body.data.profile));
      }

      setMessage("Brand profile updated successfully.");
      router.refresh();
    } catch {
      setError("We could not reach the server. Check your connection and retry.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="profile-form" onSubmit={handleSubmit}>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="form-success" role="status">
          {message}
        </p>
      ) : null}

      <div className="form-grid-two">
        <div className="field">
          <label htmlFor="brand-name">Brand name</label>
          <input
            id="brand-name"
            name="brandName"
            value={values.brandName}
            onChange={(event) => updateValue("brandName", event.target.value)}
            autoComplete="organization"
            maxLength={150}
            aria-invalid={Boolean(fieldErrors.brandName)}
            aria-describedby={
              fieldErrors.brandName ? "brand-name-error" : undefined
            }
            required
          />
          {fieldErrors.brandName ? (
            <span className="field-error" id="brand-name-error">
              {fieldErrors.brandName}
            </span>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="brand-industry">Industry</label>
          <input
            id="brand-industry"
            name="industry"
            value={values.industry}
            onChange={(event) => updateValue("industry", event.target.value)}
            maxLength={100}
            placeholder="Fashion, technology, wellness..."
            aria-invalid={Boolean(fieldErrors.industry)}
            aria-describedby={
              fieldErrors.industry ? "brand-industry-error" : undefined
            }
          />
          {fieldErrors.industry ? (
            <span className="field-error" id="brand-industry-error">
              {fieldErrors.industry}
            </span>
          ) : null}
        </div>
      </div>

      <div className="field">
        <label htmlFor="brand-contact">Contact number</label>
        <input
          id="brand-contact"
          name="contactNumber"
          type="tel"
          value={values.contactNumber}
          onChange={(event) =>
            updateValue("contactNumber", event.target.value)
          }
          autoComplete="tel"
          maxLength={15}
          placeholder="+91 98765 43210"
          aria-invalid={Boolean(fieldErrors.contactNumber)}
          aria-describedby={
            fieldErrors.contactNumber ? "brand-contact-error" : undefined
          }
        />
        {fieldErrors.contactNumber ? (
          <span className="field-error" id="brand-contact-error">
            {fieldErrors.contactNumber}
          </span>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="brand-address">Address</label>
        <input
          id="brand-address"
          name="address"
          value={values.address}
          onChange={(event) => updateValue("address", event.target.value)}
          autoComplete="street-address"
          maxLength={255}
          aria-invalid={Boolean(fieldErrors.address)}
          aria-describedby={
            fieldErrors.address ? "brand-address-error" : undefined
          }
        />
        {fieldErrors.address ? (
          <span className="field-error" id="brand-address-error">
            {fieldErrors.address}
          </span>
        ) : null}
      </div>

      <div className="form-grid-two">
        <div className="field">
          <label htmlFor="brand-city">City</label>
          <input
            id="brand-city"
            name="city"
            value={values.city}
            onChange={(event) => updateValue("city", event.target.value)}
            autoComplete="address-level2"
            maxLength={100}
            aria-invalid={Boolean(fieldErrors.city)}
            aria-describedby={
              fieldErrors.city ? "brand-city-error" : undefined
            }
          />
          {fieldErrors.city ? (
            <span className="field-error" id="brand-city-error">
              {fieldErrors.city}
            </span>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="brand-state">State</label>
          <input
            id="brand-state"
            name="state"
            value={values.state}
            onChange={(event) => updateValue("state", event.target.value)}
            autoComplete="address-level1"
            maxLength={100}
            aria-invalid={Boolean(fieldErrors.state)}
            aria-describedby={
              fieldErrors.state ? "brand-state-error" : undefined
            }
          />
          {fieldErrors.state ? (
            <span className="field-error" id="brand-state-error">
              {fieldErrors.state}
            </span>
          ) : null}
        </div>
      </div>

      <div className="form-actions">
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save changes"}
        </button>
        <span className="field-hint">Account email: {profile.email}</span>
      </div>
    </form>
  );
}
