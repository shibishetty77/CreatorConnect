"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import {
  loginSchema,
  zodFieldErrors,
} from "@/lib/validations/auth";

import { PasswordInput } from "./PasswordInput";

type LoginResponse = {
  data?: {
    redirectTo: string;
  };
  error?: {
    message: string;
    fields?: Record<string, string>;
  };
};

type LoginFormProps = {
  nextPath?: string;
};

export function LoginForm({ nextPath }: LoginFormProps) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setFieldErrors({});

    const parsed = loginSchema.safeParse({
      identifier,
      password,
      next: nextPath,
    });

    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error));
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      const payload = (await response.json().catch(() => null)) as
        | LoginResponse
        | null;

      if (!response.ok) {
        setFormError(
          payload?.error?.message ??
            "We could not sign you in. Please try again.",
        );
        setFieldErrors(payload?.error?.fields ?? {});
        return;
      }

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
        <span className="auth-eyebrow">Welcome back</span>
        <h1>Sign in to CreatorConnect</h1>
        <p>Use the email or username connected to your account.</p>
      </div>

      <form className="form-stack" onSubmit={handleSubmit} noValidate>
        {formError ? (
          <div className="form-error" role="alert">
            <p>{formError}</p>
          </div>
        ) : null}

        <div className="field">
          <label className="field-label" htmlFor="login-identifier">
            Email or username
          </label>
          <input
            id="login-identifier"
            name="identifier"
            type="text"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            autoComplete="username"
            placeholder="you@example.com"
            aria-invalid={fieldErrors.identifier ? "true" : undefined}
            aria-describedby={
              fieldErrors.identifier ? "login-identifier-error" : undefined
            }
            disabled={loading}
            required
            autoFocus
          />
          {fieldErrors.identifier ? (
            <p
              className="field-error"
              id="login-identifier-error"
              role="alert"
            >
              {fieldErrors.identifier}
            </p>
          ) : null}
        </div>

        <PasswordInput
          label="Password"
          value={password}
          onChange={setPassword}
          name="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          error={fieldErrors.password}
          disabled={loading}
          required
        />

        <button
          className="btn btn-primary btn-block"
          type="submit"
          disabled={loading}
          aria-busy={loading}
        >
          {loading ? (
            <>
              <span className="btn-spinner" aria-hidden="true" />
              Signing in...
            </>
          ) : (
            "Sign in"
          )}
        </button>
      </form>

      <p className="form-footer">
        New to CreatorConnect? <Link href="/register">Create an account</Link>
      </p>
    </>
  );
}
