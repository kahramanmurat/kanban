"use client";

import { useState } from "react";

type LogoutButtonProps = {
  onLoggedOut?: () => void;
};

export const LogoutButton = ({ onLoggedOut }: LogoutButtonProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSuccess = () => {
    if (onLoggedOut) {
      onLoggedOut();
      return;
    }

    window.location.assign("/login");
  };

  const handleLogout = async () => {
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/logout", {
        method: "POST",
        credentials: "same-origin",
        headers: { "X-Requested-With": "fetch" },
      });

      if (!response.ok) {
        setError("Unable to log out right now.");
        return;
      }

      handleSuccess();
    } catch {
      setError("Unable to log out right now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleLogout}
        disabled={isSubmitting}
        className="rounded-full border border-[var(--stroke)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)] transition hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? "Signing out..." : "Log out"}
      </button>
      {error ? (
        <p className="text-xs font-medium text-[var(--secondary-purple)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
};
