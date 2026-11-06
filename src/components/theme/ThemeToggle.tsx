"use client";

import { useEffect, useState } from "react";

const storageKey = "creatorconnect-theme";

function isDarkTheme() {
  return document.documentElement.dataset.theme === "dark";
}

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(isDarkTheme());

    function handleStorage(event: StorageEvent) {
      if (event.key === storageKey) {
        const nextIsDark = event.newValue === "dark";
        document.documentElement.dataset.theme = nextIsDark ? "dark" : "light";
        setIsDark(nextIsDark);
      }
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  function toggleTheme() {
    const nextIsDark = !isDarkTheme();
    document.documentElement.dataset.theme = nextIsDark ? "dark" : "light";
    setIsDark(nextIsDark);

    try {
      window.localStorage.setItem(storageKey, nextIsDark ? "dark" : "light");
    } catch {
      // The selected theme remains active for this page if storage is unavailable.
    }
  }

  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      aria-pressed={isDark}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      {isDark ? (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
        </svg>
      ) : (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />
        </svg>
      )}
      <span className="theme-toggle-label">{isDark ? "Light" : "Dark"}</span>
    </button>
  );
}
