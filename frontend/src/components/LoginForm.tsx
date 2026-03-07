"use client";

import { useState } from "react";

type LoginFormProps = {
  onAuthenticated?: () => void;
};

export function LoginForm({ onAuthenticated }: LoginFormProps) {
  const [username, setUsername] = useState("user");
  const [password, setPassword] = useState("password");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "fetch",
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        setError("Use the demo credentials: user / password.");
        return;
      }

      if (onAuthenticated) {
        onAuthenticated();
      } else {
        window.location.assign("/");
      }
    } catch {
      setError("Unable to sign in right now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="mt-8 flex flex-col gap-5" onSubmit={handleSubmit}>
      <label className="flex flex-col gap-2 text-sm font-semibold text-[var(--navy-dark)]">
        Username
        <input
          className="rounded-2xl border border-[var(--stroke)] bg-white px-4 py-3 text-base font-medium outline-none transition focus:border-[var(--primary-blue)]"
          name="username"
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
      </label>

      <label className="flex flex-col gap-2 text-sm font-semibold text-[var(--navy-dark)]">
        Password
        <input
          className="rounded-2xl border border-[var(--stroke)] bg-white px-4 py-3 text-base font-medium outline-none transition focus:border-[var(--primary-blue)]"
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>

      {error ? (
        <p
          className="rounded-2xl border border-[rgba(117,57,145,0.15)] bg-[rgba(117,57,145,0.08)] px-4 py-3 text-sm text-[var(--secondary-purple)]"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-full bg-[var(--secondary-purple)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
