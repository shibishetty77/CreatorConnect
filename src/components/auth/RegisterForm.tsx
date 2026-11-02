"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import type { PublicRole } from "@/lib/auth/constants";
import {
  registerSchema,
  zodFieldErrors,
} from "@/lib/validations/auth";

import { PasswordInput } from "./PasswordInput";

type RegisterResponse = {
  data?: {
    redirectTo: string;
  };
  error?: {
    message: string;
    fields?: Record<string, string>;
  };
};

export function RegisterForm() {
  const router = useRouter();
  const [role, setRole] = useState<PublicRole>("Creator");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const disabled = loading || Boolean(success);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setSuccess("");
    setFieldErrors({});

    const parsed = registerSchema.safeParse({
      username,
      name,
      email,
      password,
      confirmPassword,
      role,
    });

    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error));
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      const payload = (await response.json().catch(() => null)) as
        | RegisterResponse
        | null;

      if (!response.ok) {
        setFormError(
          payload?.error?.message ??
            "We could not create your account. Please try again.",
        );
        setFieldErrors(payload?.error?.fields ?? {});
        return;
      }

      setSuccess("Account created. Opening your dashboard...");

      await new Promise((resolve) => setTimeout(resolve, 600));

      router.replace(payload?.data?.redirectTo ?? "/dashboard");
      router.refresh();
    } catch {
      setFormError(
        "We could not reach the server. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="auth-header">
        <span className="auth-eyebrow">Join CreatorConnect</span>
        <h1>Create your account</h1>
        <p>
          Choose your role. Creator and brand accounts are available for public
          registration.
        </p>
      </div>

      <form className="form-stack" onSubmit={handleSubmit} noValidate>
        {formError ? (
          <div className="form-error" role="alert">
            <p>{formError}</p>
          </div>
        ) : null}

        {success ? (
          <div className="form-success" role="status">
            <p>{success}</p>
          </div>
        ) : null}

        <fieldset className="role-selector" disabled={disabled}>
          <legend>I am joining as</legend>
          <div className="role-option">
            <input
              id="role-creator"
              type="radio"
              name="role"
              value="Creator"
              checked={role === "Creator"}
              onChange={() => setRole("Creator")}
            />
            <label htmlFor="role-creator">
              <strong>Creator</strong>
              <span>Build your profile and find brand campaigns.</span>
            </label>
          </div>
          <div className="role-option">
            <input
              id="role-brand"
              type="radio"
              name="role"
              value="Brand"
              checked={role === "Brand"}
              onChange={() => setRole("Brand")}
            />
            <label htmlFor="role-brand">
              <strong>Brand</strong>
              <span>Launch campaigns and work with creators.</span>
            </label>
          </div>
        </fieldset>

        <div className="field">
          <label className="field-label" htmlFor="register-username">
            Username
          </label>
          <input
            id="register-username"
            name="username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            placeholder="your.username"
            aria-invalid={fieldErrors.username ? "true" : undefined}
            aria-describedby={
              fieldErrors.username ? "register-username-error" : undefined
            }
            disabled={disabled}
            required
          />
          {fieldErrors.username ? (
            <p className="field-error" id="register-username-error" role="alert">
              {fieldErrors.username}
            </p>
          ) : null}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="register-name">
            {role === "Creator" ? "Full name" : "Brand name"}
          </label>
          <input
            id="register-name"
            name="name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete={role === "Creator" ? "name" : "organization"}
            placeholder={
              role === "Creator" ? "Ananya Rao" : "NovaThread Apparel"
            }
            aria-invalid={fieldErrors.name ? "true" : undefined}
            aria-describedby={
              fieldErrors.name ? "register-name-error" : "register-name-hint"
            }
            disabled={disabled}
            required
          />
          <p className="field-hint" id="register-name-hint">
            {role === "Creator"
              ? "Enter your first and last name."
              : "Use the public name of your brand."}
          </p>
          {fieldErrors.name ? (
            <p className="field-error" id="register-name-error" role="alert">
              {fieldErrors.name}
            </p>
          ) : null}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="register-email">
            Email address
          </label>
          <input
            id="register-email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={fieldErrors.email ? "true" : undefined}
            aria-describedby={
              fieldErrors.email ? "register-email-error" : undefined
            }
            disabled={disabled}
            required
          />
          {fieldErrors.email ? (
            <p className="field-error" id="register-email-error" role="alert">
              {fieldErrors.email}
            </p>
          ) : null}
        </div>

        <PasswordInput
          label="Password"
          value={password}
          onChange={setPassword}
          name="password"
          autoComplete="new-password"
          placeholder="Create a strong password"
          hint="At least 8 characters, including a letter and a number."
          error={fieldErrors.password}
          disabled={disabled}
          required
        />

        <PasswordInput
          label="Confirm password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          name="confirmPassword"
          autoComplete="new-password"
          placeholder="Re-enter your password"
          error={fieldErrors.confirmPassword}
          disabled={disabled}
          required
        />

        <button
          className="btn btn-primary btn-block"
          type="submit"
          disabled={disabled}
          aria-busy={loading}
        >
          {loading ? (
            <>
              <span className="btn-spinner" aria-hidden="true" />
              Creating account...
            </>
          ) : (
            "Create account"
          )}
        </button>
      </form>

      <p className="form-footer">
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </>
  );
}
