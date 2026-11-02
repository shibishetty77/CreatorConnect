"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import type { CreatorProfileRecord } from "@/lib/repositories/creator-profiles";

type CreatorProfileFormProps = {
  profile: CreatorProfileRecord;
};

type FormValues = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phone: string;
  bio: string;
  address: string;
  city: string;
  state: string;
  profilePictureUrl: string;
};

type ApiErrorBody = {
  error?: {
    message?: string;
    fields?: Record<string, string>;
  };
};

function valuesFromProfile(profile: CreatorProfileRecord): FormValues {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    dateOfBirth: profile.dateOfBirth ?? "",
    phone: profile.phone ?? "",
    bio: profile.bio ?? "",
    address: profile.address ?? "",
    city: profile.city ?? "",
    state: profile.state ?? "",
    profilePictureUrl: profile.profilePictureUrl ?? "",
  };
}

export function CreatorProfileForm({ profile }: CreatorProfileFormProps) {
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
      const response = await fetch("/api/creator/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = (await response.json().catch(() => null)) as
        | (ApiErrorBody & { data?: { profile?: CreatorProfileRecord } })
        | null;

      if (!response.ok) {
        setFieldErrors(body?.error?.fields ?? {});
        setError(body?.error?.message ?? "We could not save your profile.");
        return;
      }

      if (body?.data?.profile) {
        setValues(valuesFromProfile(body.data.profile));
      }

      setMessage("Profile updated successfully.");
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
          <label htmlFor="creator-first-name">First name</label>
          <input
            id="creator-first-name"
            name="firstName"
            value={values.firstName}
            onChange={(event) => updateValue("firstName", event.target.value)}
            autoComplete="given-name"
            maxLength={50}
            aria-invalid={Boolean(fieldErrors.firstName)}
            aria-describedby={
              fieldErrors.firstName ? "creator-first-name-error" : undefined
            }
            required
          />
          {fieldErrors.firstName ? (
            <span className="field-error" id="creator-first-name-error">
              {fieldErrors.firstName}
            </span>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="creator-last-name">Last name</label>
          <input
            id="creator-last-name"
            name="lastName"
            value={values.lastName}
            onChange={(event) => updateValue("lastName", event.target.value)}
            autoComplete="family-name"
            maxLength={50}
            aria-invalid={Boolean(fieldErrors.lastName)}
            aria-describedby={
              fieldErrors.lastName ? "creator-last-name-error" : undefined
            }
          />
          {fieldErrors.lastName ? (
            <span className="field-error" id="creator-last-name-error">
              {fieldErrors.lastName}
            </span>
          ) : null}
        </div>
      </div>

      <div className="form-grid-two">
        <div className="field">
          <label htmlFor="creator-date-of-birth">Date of birth</label>
          <input
            id="creator-date-of-birth"
            name="dateOfBirth"
            type="date"
            value={values.dateOfBirth}
            onChange={(event) =>
              updateValue("dateOfBirth", event.target.value)
            }
            aria-invalid={Boolean(fieldErrors.dateOfBirth)}
            aria-describedby={
              fieldErrors.dateOfBirth ? "creator-date-of-birth-error" : undefined
            }
          />
          {fieldErrors.dateOfBirth ? (
            <span className="field-error" id="creator-date-of-birth-error">
              {fieldErrors.dateOfBirth}
            </span>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="creator-phone">Phone</label>
          <input
            id="creator-phone"
            name="phone"
            type="tel"
            value={values.phone}
            onChange={(event) => updateValue("phone", event.target.value)}
            autoComplete="tel"
            maxLength={15}
            placeholder="+91 98765 43210"
            aria-invalid={Boolean(fieldErrors.phone)}
            aria-describedby={
              fieldErrors.phone ? "creator-phone-error" : undefined
            }
          />
          {fieldErrors.phone ? (
            <span className="field-error" id="creator-phone-error">
              {fieldErrors.phone}
            </span>
          ) : null}
        </div>
      </div>

      <div className="field">
        <label htmlFor="creator-address">Address</label>
        <input
          id="creator-address"
          name="address"
          value={values.address}
          onChange={(event) => updateValue("address", event.target.value)}
          autoComplete="street-address"
          maxLength={255}
          aria-invalid={Boolean(fieldErrors.address)}
          aria-describedby={
            fieldErrors.address ? "creator-address-error" : undefined
          }
        />
        {fieldErrors.address ? (
          <span className="field-error" id="creator-address-error">
            {fieldErrors.address}
          </span>
        ) : null}
      </div>

      <div className="form-grid-two">
        <div className="field">
          <label htmlFor="creator-city">City</label>
          <input
            id="creator-city"
            name="city"
            value={values.city}
            onChange={(event) => updateValue("city", event.target.value)}
            autoComplete="address-level2"
            maxLength={100}
            aria-invalid={Boolean(fieldErrors.city)}
            aria-describedby={
              fieldErrors.city ? "creator-city-error" : undefined
            }
          />
          {fieldErrors.city ? (
            <span className="field-error" id="creator-city-error">
              {fieldErrors.city}
            </span>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="creator-state">State</label>
          <input
            id="creator-state"
            name="state"
            value={values.state}
            onChange={(event) => updateValue("state", event.target.value)}
            autoComplete="address-level1"
            maxLength={100}
            aria-invalid={Boolean(fieldErrors.state)}
            aria-describedby={
              fieldErrors.state ? "creator-state-error" : undefined
            }
          />
          {fieldErrors.state ? (
            <span className="field-error" id="creator-state-error">
              {fieldErrors.state}
            </span>
          ) : null}
        </div>
      </div>

      <div className="field">
        <label htmlFor="creator-bio">Bio</label>
        <textarea
          id="creator-bio"
          name="bio"
          value={values.bio}
          onChange={(event) => updateValue("bio", event.target.value)}
          rows={5}
          maxLength={2000}
          placeholder="Share your content style, audience, and the brands you enjoy working with."
          aria-invalid={Boolean(fieldErrors.bio)}
          aria-describedby={fieldErrors.bio ? "creator-bio-error" : undefined}
        />
        <span className="field-hint">
          {values.bio.length}/2000 characters
        </span>
        {fieldErrors.bio ? (
          <span className="field-error" id="creator-bio-error">
            {fieldErrors.bio}
          </span>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="creator-picture">Profile picture URL</label>
        <input
          id="creator-picture"
          name="profilePictureUrl"
          type="url"
          value={values.profilePictureUrl}
          onChange={(event) =>
            updateValue("profilePictureUrl", event.target.value)
          }
          maxLength={500}
          placeholder="https://example.com/avatar.jpg"
          aria-invalid={Boolean(fieldErrors.profilePictureUrl)}
          aria-describedby={
            fieldErrors.profilePictureUrl
              ? "creator-picture-error"
              : "creator-picture-hint"
          }
        />
        <span className="field-hint" id="creator-picture-hint">
          Use a publicly reachable http:// or https:// image URL.
        </span>
        {fieldErrors.profilePictureUrl ? (
          <span className="field-error" id="creator-picture-error">
            {fieldErrors.profilePictureUrl}
          </span>
        ) : null}
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
